import { forwardRef, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { EventsService } from './events.service';
import { WorkshopModule } from '../workshop.module';

@Module({
    providers: [EventsService],
    imports: [CacheModule.register(), forwardRef(() => WorkshopModule)],
    exports: [EventsService]
})
export class EventsModule {}
