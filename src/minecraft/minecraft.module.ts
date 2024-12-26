import { Module } from '@nestjs/common';
import { MinecraftController } from './minecraft.controller.v1';
import { MinecraftService } from './minecraft.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
    controllers: [MinecraftController],
    providers: [MinecraftService, PrismaService],
    imports: [CacheModule.register()]
})
export class MinecraftModule { }