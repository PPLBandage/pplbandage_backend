import { Module } from '@nestjs/common';
import { EmotesController } from './emotes.controller.v1';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
    controllers: [EmotesController],
    imports: [CacheModule.register()]
})
export class EmotesModule {}
