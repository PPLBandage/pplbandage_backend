import { Injectable, Logger } from '@nestjs/common';
import { BandageFull } from 'src/interfaces/interfaces';
import { ProxyService } from 'src/proxy/proxy.service';

export const ThreadType = {
    General: 1,
    Moderation: 2,
    Feedback: 17,
    Errors: 15
};

@Injectable()
export class TelegramService {
    private readonly logger = new Logger(TelegramService.name);
    private readonly baseUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

    constructor(private readonly proxy: ProxyService) {}
    escapeMd(text: string) {
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }

    private async callTelegram(method: string, body: unknown) {
        const url = `${this.baseUrl}/${method}`;

        const res = await this.proxy.makeRequest(url, 'POST', body, {
            'Content-Type': 'application/json'
        });

        if (res.status < 200 || res.status >= 300) {
            this.logger.error(
                `Telegram API error: ${res.status}: \`\`\``,
                JSON.stringify(this.proxy.getJSON(res.data), () => {}, 4),
                '```'
            );
            throw new Error(`Telegram API error: ${res.status}`);
        }

        return this.proxy.getJSON(res.data);
    }

    async sendToThread(
        chatId: number | string,
        threadId: number,
        text: string
    ) {
        return this.callTelegram('sendMessage', {
            chat_id: chatId,
            text: this.escapeMd(text),
            message_thread_id: threadId,
            parse_mode: 'Markdown'
        });
    }

    async sendPhotoToThread(
        chatId: number | string,
        threadId: number,
        photo: string,
        caption?: string
    ) {
        return this.callTelegram('sendPhoto', {
            chat_id: chatId,
            photo, // URL
            caption: caption ? this.escapeMd(caption) : undefined,
            message_thread_id: threadId,
            parse_mode: 'Markdown'
        });
    }

    async doBandageNotification(
        message: string,
        bandage: BandageFull,
        bandage_tags?: string[]
    ) {
        try {
            const tags =
                bandage_tags ?? bandage.tags?.map?.(tag => tag.name) ?? [];

            const text =
                `${message} · __[${this.escapeMd(bandage.User.name)}](${process.env.DOMAIN}/users/${bandage.User.username})__\n\n` +
                `[${this.escapeMd(bandage.title)}](${process.env.DOMAIN}/workshop/${bandage.externalId})\n` +
                `${this.escapeMd(bandage.description || '<нет описания>')}\n\n` +
                `*Теги*\n${`\`${tags.join('`, `')}\``}\n\n` +
                `*Имеет раздельные типы*\n${bandage.split_type ? 'Да' : 'Нет'}`;

            if (bandage.thumbnail_asset !== null) {
                await this.sendPhotoToThread(
                    process.env.GROUP_ID!,
                    ThreadType.Moderation,
                    `${process.env.DOMAIN}/api/v1/workshop/${bandage.externalId}/og?token=${process.env.WORKSHOP_TOKEN}`,
                    text
                );
            } else {
                await this.sendToThread(
                    process.env.GROUP_ID!,
                    ThreadType.Moderation,
                    text
                );
            }
        } catch (e) {
            this.logger.error(
                `Cannot do Telegram notification about https://pplbandage.ru/workshop/${bandage.externalId} (${e})`
            );

            await this.sendToThread(
                process.env.GROUP_ID!,
                ThreadType.Moderation,
                `${process.env.DOMAIN}/workshop/${bandage.externalId}`
            );
        }
    }
}
