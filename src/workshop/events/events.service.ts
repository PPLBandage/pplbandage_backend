import {
    Inject,
    Injectable,
    NotFoundException,
    forwardRef
} from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from 'src/prisma/prisma.service';
import { Events, Tags } from '@prisma/client';
import {
    CreateEventDTO,
    DeleteEventDTO,
    EditEventDTO
} from 'src/admin/dto/events.dto';
import { WorkshopService } from '../workshop.service';

@Injectable()
export class EventsService {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private prisma: PrismaService,
        @Inject(forwardRef(() => WorkshopService))
        private workshopService: WorkshopService
    ) {}

    ttl: number = 1000 * 60;

    async getEvents() {
        const cache = await this.cacheManager.get<string>('events');

        let data: (Events & { Tags: Tags[] })[];
        if (!cache) {
            data = await this.prisma.events.findMany({
                include: { Tags: true }
            });

            await this.cacheManager.set(
                'events',
                JSON.stringify(data),
                this.ttl
            );
        } else {
            data = JSON.parse(cache);
        }

        return data.map(el => ({
            id: el.id,
            name: el.name,
            start: el.start_date,
            end: el.end_date,
            boost_amount: el.boost_amount,
            tags: el.Tags.map(tag => tag.name)
        }));
    }

    private isDateInRange(start: Date, end: Date): boolean {
        const now = new Date();
        const year = now.getFullYear();

        const startDate = new Date(start);
        const endDate = new Date(end);

        startDate.setFullYear(year);
        endDate.setFullYear(year);

        if (startDate <= endDate) {
            return now >= startDate && now <= endDate;
        }

        return now >= startDate || now <= endDate;
    }

    async getEventBoostForTags(tags: string[]) {
        const events = await this.getEvents();

        for (const event of events) {
            if (!this.isDateInRange(new Date(event.start), new Date(event.end)))
                continue;

            if (!event.tags.some(tag => tags.includes(tag.toLowerCase())))
                continue;

            return event.boost_amount;
        }

        return 0;
    }

    async purgeCache() {
        await this.cacheManager.del('events');
    }

    async createEvent(data: CreateEventDTO) {
        const tags = await this.workshopService.createTags(data.tags, true);

        await this.prisma.events.create({
            data: {
                name: data.name,
                start_date: data.start_date,
                end_date: data.end_date,
                boost_amount: data.boost_amount,
                Tags: { connect: tags.map(id => ({ id })) }
            }
        });

        // Не уверен, что оно тут надо, но пускай будет
        await this.workshopService.clearTags();
        await this.purgeCache();
    }

    async editEvent(data: EditEventDTO) {
        const found = await this.prisma.events.count({
            where: { id: data.id }
        });
        if (!found) throw new NotFoundException();

        const tags = await this.workshopService.createTags(data.tags, true);
        await this.prisma.events.update({
            where: { id: data.id },
            data: {
                name: data.name,
                start_date: data.start_date,
                end_date: data.end_date,
                boost_amount: data.boost_amount,
                Tags: { set: tags.map(id => ({ id })) }
            }
        });

        await this.workshopService.clearTags();
        await this.purgeCache();
    }

    async deleteEvent(data: DeleteEventDTO) {
        await this.prisma.events.delete({ where: { id: data.id } });
        await this.purgeCache();
    }
}
