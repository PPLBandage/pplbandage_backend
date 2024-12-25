import { Module } from '@nestjs/common';
import { WorkshopController } from './workshop.controller.v1';
import { WorkshopService } from './workshop.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { NotificationService } from 'src/notifications/notifications.service';
import { DiscordNotificationService } from 'src/notifications/discord.service';
import { AuthService } from 'src/auth/auth.service';
import { UserService } from 'src/user/user.service';

@Module({
    controllers: [WorkshopController],
    providers: [
        WorkshopService,
        PrismaService,
        NotificationService,
        DiscordNotificationService,
        AuthService,
        UserService
    ],
    imports: [CacheModule.register()]
})
export class WorkshopModule { }
