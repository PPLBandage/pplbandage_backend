import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthModule } from './auth/auth.module';
import { MinecraftModule } from './minecraft/minecraft.module';
import { UsersModule } from './user/user.module';
import { WorkshopModule } from './workshop/workshop.module';
import { RootModule } from './root/root.module';
import { CustomThrottlerGuard } from './guards/throttlerBehindProxy.guard';
import { AvatarsModule } from './avatars/avatars.module';
import { ConnectionsModule } from './connections/connections.module';
import { EmotesModule } from './emotes/emotes.module';
import { TelegramModule } from './notifications/telegram.module';
import { AdminModule } from './admin/admin.module';
import { ThumbnailsModule } from './thumbnails/thumbnails.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';

@Module({
    providers: [{ provide: APP_GUARD, useClass: CustomThrottlerGuard }],
    imports: [
        ThrottlerModule.forRoot([{ ttl: 120000, limit: 150 }]),
        CacheModule.register(),
        ScheduleModule.forRoot(),
        PrismaModule,
        RootModule,
        AuthModule,
        MinecraftModule,
        UsersModule,
        WorkshopModule,
        AvatarsModule,
        ConnectionsModule,
        EmotesModule,
        TelegramModule,
        AdminModule,
        ThumbnailsModule
    ]
})
export class AppModule {}
