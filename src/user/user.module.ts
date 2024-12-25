import { Module } from '@nestjs/common';
import { UserController } from './user.controller.v1';
import { UserService } from './user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthService } from 'src/auth/auth.service';
import { NotificationService } from 'src/notifications/notifications.service';
import { MinecraftService } from 'src/minecraft/minecraft.service';

@Module({
    controllers: [UserController],
    providers: [
        UserService,
        PrismaService,
        AuthService,
        NotificationService,
        MinecraftService
    ],
    imports: [CacheModule.register()]
})
export class UsersModule { }
