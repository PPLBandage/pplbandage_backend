import { Module } from '@nestjs/common';
import { WorkshopController } from './workshop.controller.v1';
import { WorkshopService } from './workshop.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { NotificationService } from 'src/notifications/notifications.service';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/user/user.module';
import { MinecraftModule } from 'src/minecraft/minecraft.module';
import { TelegramModule } from 'src/notifications/telegram.module';

@Module({
    controllers: [WorkshopController],
    providers: [WorkshopService, PrismaService, NotificationService],
    imports: [
        CacheModule.register(),
        AuthModule,
        UsersModule,
        MinecraftModule,
        TelegramModule
    ]
})
export class WorkshopModule {}
