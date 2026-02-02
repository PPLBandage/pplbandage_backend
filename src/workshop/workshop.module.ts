import { forwardRef, Module } from '@nestjs/common';
import { WorkshopController } from './workshop.controller.v1';
import { WorkshopService } from './workshop.service';
import { CacheModule } from '@nestjs/cache-manager';
import { NotificationService } from 'src/notifications/notifications.service';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/user/user.module';
import { MinecraftModule } from 'src/minecraft/minecraft.module';
import { TelegramModule } from 'src/notifications/telegram.module';
import { KVDataBase } from 'src/prisma/kv.service';
import { EventsModule } from './events/events.module';
import { ThumbnailsModule } from 'src/thumbnails/thumbnails.module';
import { WorkshopSchedulers } from './schedulers.service';

@Module({
    controllers: [WorkshopController],
    providers: [
        WorkshopService,
        NotificationService,
        KVDataBase,
        WorkshopSchedulers
    ],
    imports: [
        CacheModule.register(),
        AuthModule,
        UsersModule,
        MinecraftModule,
        TelegramModule,
        ThumbnailsModule,
        forwardRef(() => EventsModule)
    ],
    exports: [WorkshopService]
})
export class WorkshopModule {}
