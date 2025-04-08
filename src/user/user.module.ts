import { Module } from '@nestjs/common';
import { UserController } from './user.controller.v1';
import { UserService } from './user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthService } from 'src/auth/auth.service';
import { NotificationService } from 'src/notifications/notifications.service';
import { MinecraftService } from 'src/minecraft/minecraft.service';
import { DiscordNotificationService } from 'src/notifications/discord.service';

@Module({
    controllers: [UserController],
    providers: [
        UserService,
        PrismaService,
        AuthService,
        NotificationService,
        MinecraftService,
        DiscordNotificationService
    ],
    imports: [CacheModule.register()]
})
export class UsersModule {}
