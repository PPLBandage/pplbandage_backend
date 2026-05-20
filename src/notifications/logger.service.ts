import { Injectable, LoggerService, ConsoleLogger } from '@nestjs/common';
import { TelegramService, ThreadType } from './telegram.service';

@Injectable()
export class TelegramLogger implements LoggerService {
    private readonly consoleLogger = new ConsoleLogger();
    private escapeMd;
    constructor(private readonly telegramService: TelegramService) {
        this.escapeMd = this.telegramService.escapeMd;
    }

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

    send_format(level: string, message: string, context?: string) {
        this.send(
            `*\\[${level}\\]${context ? `\\[${this.escapeMd(context)}\\]` : ''}* ${this.escapeMd(message)}`
        );
    }

    log(message: string, context?: string, telegram?: boolean) {
        this.consoleLogger.log(message, context);
        if (telegram) this.send_format('LOG', message, context);
    }

    error(message: string, trace?: string, context?: string) {
        this.consoleLogger.error(message, trace, context);
        this.send_format('ERROR', message, context);
    }

    warn(message: string, context?: string, telegram?: boolean) {
        this.consoleLogger.warn(message, context);
        if (telegram) this.send_format('WARN', message, context);
    }

    debug(message: string, context?: string, telegram?: boolean) {
        this.consoleLogger.debug(message, context);
        if (telegram) this.send_format('DEBUG', message, context);
    }

    verbose(message: string, context?: string, telegram?: boolean) {
        this.consoleLogger.verbose(message, context);
        if (telegram) this.send_format('VERBOSE', message, context);
    }
}
