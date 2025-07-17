import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.v1';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { CacheModule } from '@nestjs/cache-manager';
import { MinecraftService } from 'src/minecraft/minecraft.service';
import { DiscordAuthModule } from './providers/discord/discord.module';
import { MinecraftAuthModule } from './providers/minecraft/minecraft.module';

@Module({
    controllers: [AuthController],
    providers: [AuthService, PrismaService, UserService, MinecraftService],
    imports: [
        CacheModule.register(),
        forwardRef(() => DiscordAuthModule),
        forwardRef(() => MinecraftAuthModule)
    ],
    exports: [AuthService]
})
export class AuthModule {}

