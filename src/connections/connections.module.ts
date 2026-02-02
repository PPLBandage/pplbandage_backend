import { Module } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { MinecraftModule } from 'src/minecraft/minecraft.module';
import { ConnectionsController } from './connections.controller.v1';
import { AuthModule } from 'src/auth/auth.module';
import { DiscordAuthModule } from 'src/auth/providers/discord/discord.module';
import { GoogleAuthModule } from 'src/auth/providers/google/google.module';
import { TwitchAuthModule } from 'src/auth/providers/twitch/twitch.module';
import { TelegramAuthModule } from 'src/auth/providers/telegram/telegram.module';

@Module({
    controllers: [ConnectionsController],
    providers: [ConnectionsService],
    imports: [
        MinecraftModule,
        AuthModule,
        DiscordAuthModule,
        GoogleAuthModule,
        TwitchAuthModule,
        TelegramAuthModule
    ],
    exports: [ConnectionsService]
})
export class ConnectionsModule {}
