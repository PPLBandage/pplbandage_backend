import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BandageFull } from 'src/interfaces/interfaces';
import { Telegraf } from 'telegraf';
import { InputFile } from 'telegraf/typings/core/types/typegram';

export const ThreadType = {
    General: 1,
    Moderation: 2,
    Feedback: 17,
    Errors: 15
};

@Injectable()
export class TelegramService implements OnModuleInit {
    private readonly logger = new Logger(TelegramService.name);
    private bot: Telegraf;

    constructor() {
        this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
    }

    escapeMd(text: string) {
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }

    async onModuleInit() {
        this.bot.command('ping', ctx => ctx.reply('pong'));

        void this.bot.launch();
        this.logger.log('Telegram bot started');
    }

    async sendToThread(
        chatId: number | string,
        threadId: number,
        text: string
    ) {
        return this.bot.telegram.sendMessage(chatId, text, {
            message_thread_id: threadId,
            parse_mode: 'Markdown'
        });
    }

    async sendPhotoToThread(
        chatId: number | string,
        threadId: number,
        photo: string | InputFile,
        caption?: string
    ) {
        return this.bot.telegram.sendPhoto(chatId, photo, {
            caption,
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
                    2,
                    {
                        url: `${process.env.DOMAIN}/api/v1/workshop/${bandage.externalId}/og?token=${process.env.WORKSHOP_TOKEN}`,
                        filename: 'Bandage'
                    },
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
