import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramLogger } from './logger.service';
import { ProxyModule } from 'src/proxy/proxy.module';

@Module({
    providers: [TelegramService, TelegramLogger],
    imports: [ProxyModule],
    exports: [TelegramService, TelegramLogger]
})
export class TelegramModule {}
