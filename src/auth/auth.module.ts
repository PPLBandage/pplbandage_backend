import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.v1';
import { AuthService } from './auth.service';
import { CacheModule } from '@nestjs/cache-manager';
import { MinecraftService } from 'src/minecraft/minecraft.service';
import { DiscordAuthModule } from './providers/discord/discord.module';
import { MinecraftAuthModule } from './providers/minecraft/minecraft.module';
import { GoogleAuthModule } from './providers/google/google.module';
import { TwitchAuthModule } from './providers/twitch/twitch.module';
import { TelegramAuthModule } from './providers/telegram/telegram.module';
import { UsersModule } from 'src/user/user.module';

@Module({
    controllers: [AuthController],
    providers: [AuthService, MinecraftService],
    imports: [
        CacheModule.register(),
        forwardRef(() => UsersModule),
        forwardRef(() => DiscordAuthModule),
        forwardRef(() => MinecraftAuthModule),
        forwardRef(() => GoogleAuthModule),
        forwardRef(() => TwitchAuthModule),
        forwardRef(() => TelegramAuthModule)
    ],
    exports: [AuthService]
})
export class AuthModule {}
