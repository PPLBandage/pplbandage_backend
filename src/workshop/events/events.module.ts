import { forwardRef, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { EventsService } from './events.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WorkshopModule } from '../workshop.module';

@Module({
    providers: [EventsService, PrismaService],
    imports: [CacheModule.register(), forwardRef(() => WorkshopModule)],
    exports: [EventsService]
})
export class EventsModule {}
