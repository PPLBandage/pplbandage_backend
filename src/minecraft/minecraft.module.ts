import { Module } from '@nestjs/common';
import { MinecraftController } from './minecraft.controller.v1';
import { MinecraftService } from './minecraft.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { MinecraftScheduler } from './scheduler.service';

@Module({
    controllers: [MinecraftController],
    providers: [MinecraftService, PrismaService, MinecraftScheduler],
    imports: [CacheModule.register(), ScheduleModule.forRoot()],
    exports: [MinecraftService]
})
export class MinecraftModule {}

