import { Injectable, LoggerService, ConsoleLogger } from '@nestjs/common';
import { TelegramService, ThreadType } from './telegram.service';

@Injectable()
export class TelegramLogger implements LoggerService {
    private readonly consoleLogger = new ConsoleLogger();
    constructor(private readonly telegramService: TelegramService) {}

    private async send(message: string) {
        try {
            await this.telegramService.sendToThread(
                process.env.GROUP_ID!,
                ThreadType.Errors,
                message.slice(0, 4000)
            );
        } catch (e) {
            this.consoleLogger.error('Ошибка при отправке лога в Telegram:', e);
        }
    }

    log(message: string, context?: string, telegram?: boolean) {
        this.consoleLogger.log(message, context);
        if (telegram)
            this.send(`*[LOG]${context ? `[${context}]` : ''}* ${message}`);
    }

    error(message: string, trace?: string, context?: string) {
        this.consoleLogger.error(message, trace, context);
        this.send(
            `*[ERROR]${context ? `[${context}]` : ''}* ${message}\n${trace ?? ''}`
        );
    }

    warn(message: string, context?: string, telegram?: boolean) {
        this.consoleLogger.warn(message, context);
        if (telegram)
            this.send(`*[WARN]${context ? `[${context}]` : ''}* ${message}`);
    }

    debug(message: string, context?: string, telegram?: boolean) {
        this.consoleLogger.debug(message, context);
        if (telegram)
            this.send(`*[DEBUG]${context ? `[${context}]` : ''}* ${message}`);
    }

    verbose(message: string, context?: string, telegram?: boolean) {
        this.consoleLogger.verbose(message, context);
        if (telegram)
            this.send(`*[VERBOSE]${context ? `[${context}]` : ''}* ${message}`);
    }
}
