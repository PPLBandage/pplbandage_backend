import { forwardRef, Module } from '@nestjs/common';
import { MinecraftController } from './minecraft.controller.v1';
import { MinecraftService } from './minecraft.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { MinecraftScheduler } from './scheduler.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    controllers: [MinecraftController],
    providers: [MinecraftService, PrismaService, MinecraftScheduler],
    imports: [
        CacheModule.register(),
        ScheduleModule.forRoot(),
        forwardRef(() => AuthModule)
    ],
    exports: [MinecraftService]
})
export class MinecraftModule {}
