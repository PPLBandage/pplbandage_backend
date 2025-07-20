import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.v1';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { CacheModule } from '@nestjs/cache-manager';
import { MinecraftService } from 'src/minecraft/minecraft.service';
import { DiscordAuthModule } from './providers/discord/discord.module';
import { MinecraftAuthModule } from './providers/minecraft/minecraft.module';
import { GoogleAuthModule } from './providers/google/google.module';
import { TwitchAuthModule } from './providers/twitch/twitch.module';

@Module({
    controllers: [AuthController],
    providers: [AuthService, PrismaService, UserService, MinecraftService],
    imports: [
        CacheModule.register(),
        forwardRef(() => DiscordAuthModule),
        forwardRef(() => MinecraftAuthModule),
        forwardRef(() => GoogleAuthModule),
        forwardRef(() => TwitchAuthModule)
    ],
    exports: [AuthService]
})
export class AuthModule {}

