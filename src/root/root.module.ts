import { Module } from '@nestjs/common';
import { RootController } from './root.controller.v1';
import { RootService } from './root.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { DiscordNotificationService } from 'src/notifications/discord.service';
import { UserService } from 'src/user/user.service';

@Module({
    controllers: [RootController],
    providers: [
        RootService,
        PrismaService,
        DiscordNotificationService,
        UserService
    ],
    imports: [CacheModule.register()]
})
export class RootModule {}
