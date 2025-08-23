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

@Module({
    providers: [{ provide: APP_GUARD, useClass: CustomThrottlerGuard }],
    imports: [
        ThrottlerModule.forRoot([{ ttl: 120000, limit: 150 }]),
        CacheModule.register(),
        RootModule,
        AuthModule,
        MinecraftModule,
        UsersModule,
        WorkshopModule,
        AvatarsModule,
        ConnectionsModule,
        EmotesModule
    ]
})
export class AppModule {}
