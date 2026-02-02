import { forwardRef, Module } from '@nestjs/common';
import { MinecraftController } from './minecraft.controller.v1';
import { MinecraftService } from './minecraft.service';
import { CacheModule } from '@nestjs/cache-manager';
import { MinecraftScheduler } from './scheduler.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    controllers: [MinecraftController],
    providers: [MinecraftService, MinecraftScheduler],
    imports: [CacheModule.register(), forwardRef(() => AuthModule)],
    exports: [MinecraftService]
})
export class MinecraftModule {}
