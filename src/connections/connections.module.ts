import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConnectionsService } from './connections.service';
import { MinecraftModule } from 'src/minecraft/minecraft.module';
import { ConnectionsController } from './connections.controller.v1';
import { AuthModule } from 'src/auth/auth.module';
import { DiscordAuthModule } from 'src/auth/providers/discord/discord.module';
import { GoogleAuthModule } from 'src/auth/providers/google/google.module';

@Module({
    controllers: [ConnectionsController],
    providers: [ConnectionsService, PrismaService],
    imports: [MinecraftModule, AuthModule, DiscordAuthModule, GoogleAuthModule],
    exports: [ConnectionsService]
})
export class ConnectionsModule {}

