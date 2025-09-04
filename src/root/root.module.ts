import { Module } from '@nestjs/common';
import { RootController } from './root.controller.v1';
import { RootService } from './root.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { UserService } from 'src/user/user.service';
import { AuthModule } from 'src/auth/auth.module';
import { TelegramModule } from 'src/notifications/telegram.module';

@Module({
    controllers: [RootController],
    providers: [RootService, PrismaService, UserService],
    imports: [CacheModule.register(), AuthModule, TelegramModule]
})
export class RootModule {}
