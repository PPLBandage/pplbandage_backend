import { Module } from '@nestjs/common';
import { EmotesController } from './emotes.controller.v1';
import { CacheModule } from '@nestjs/cache-manager';
import { EmotesService } from './emotes.service';
import { ProxyModule } from 'src/proxy/proxy.module';

@Module({
    controllers: [EmotesController],
    providers: [EmotesService],
    imports: [CacheModule.register(), ProxyModule]
})
export class EmotesModule {}
