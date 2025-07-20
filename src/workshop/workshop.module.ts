import { Module } from '@nestjs/common';
import { WorkshopController } from './workshop.controller.v1';
import { WorkshopService } from './workshop.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { NotificationService } from 'src/notifications/notifications.service';
import { DiscordNotificationService } from 'src/notifications/discord.service';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/user/user.module';
import { MinecraftModule } from 'src/minecraft/minecraft.module';

@Module({
    controllers: [WorkshopController],
    providers: [
        WorkshopService,
        PrismaService,
        NotificationService,
        DiscordNotificationService
    ],
    imports: [CacheModule.register(), AuthModule, UsersModule, MinecraftModule]
})
export class WorkshopModule {}

