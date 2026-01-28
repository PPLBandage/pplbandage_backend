import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WorkshopService } from './workshop.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { join } from 'path';
import { readdir } from 'fs/promises';
import { BandageFull } from 'src/interfaces/interfaces';

@Injectable()
export class WorkshopSchedulers {
    private readonly logger = new Logger(WorkshopSchedulers.name);

    private working: boolean = false;
    constructor(
        private readonly bandageService: WorkshopService,
        private readonly prismaService: PrismaService
    ) {}

    @Cron('0 0 0 * * *')
    async scheduledThumbnailRendering() {
        if (this.working) return;
        const bandages = await this.prismaService.bandage.findMany();

        const contents = await readdir(
            join(process.env.CACHE_FOLDER!, 'thumbnails'),
            {
                withFileTypes: true
            }
        );
        const renderedThumbnails = contents
            .filter(i => i.isFile())
            .map(i => i.name);

        const notRenderedBandages = bandages.filter(
            b => !renderedThumbnails.includes(b.thumbnail_asset ?? '')
        );

        if (notRenderedBandages.length === 0) return;

        this.logger.log('Started rendering bandages thumbnails');
        this.working = true;

        Promise.allSettled(
            notRenderedBandages.map(b =>
                this.bandageService.renderAndSetThumbnail(b as BandageFull)
            )
        )
            .then(() => {
                this.working = false;
                this.logger.log(
                    `Successfully rendered ${notRenderedBandages.length} thumbnails`
                );
            })
            .catch(e => this.logger.error(e));
    }
}
