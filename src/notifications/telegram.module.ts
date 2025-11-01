import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramLogger } from './logger.service';

@Module({
    providers: [TelegramService, TelegramLogger],
    exports: [TelegramService, TelegramLogger]
})
export class TelegramModule {}
