import { Module } from '@nestjs/common';
import { UserController } from './user.controller.v1';
import { UserService } from './user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { NotificationService } from 'src/notifications/notifications.service';
import { AuthModule } from 'src/auth/auth.module';
import { MinecraftModule } from 'src/minecraft/minecraft.module';

@Module({
    controllers: [UserController],
    providers: [UserService, PrismaService, NotificationService],
    imports: [CacheModule.register(), AuthModule, MinecraftModule]
})
export class UsersModule {}

