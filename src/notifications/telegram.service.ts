import { Injectable, OnModuleInit } from '@nestjs/common';
import { BandageFull } from 'src/common/bandage_response';
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
    private bot: Telegraf;

    constructor() {
        this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
    }

    async onModuleInit() {
        this.bot.command('ping', ctx => ctx.reply('pong'));

        this.bot.launch();
        console.log('Telegram bot started');
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
                `${message} · __[${bandage.User.name}](${process.env.DOMAIN}/users/${bandage.User.username})__\n\n` +
                `[${bandage.title}](${process.env.DOMAIN}/workshop/${bandage.externalId})\n` +
                `${bandage.description || '<нет описания>'}\n\n` +
                `*Теги*\n${`\`${tags.join('`, `')}\``}\n\n` +
                `*Имеет раздельные типы*\n${bandage.split_type ? 'Да' : 'Нет'}`;

            const message_o = await this.sendPhotoToThread(
                process.env.GROUP_ID!,
                ThreadType.Moderation,
                {
                    url: `${process.env.DOMAIN}/api/v1/workshop/${bandage.externalId}/og?token=${process.env.WORKSHOP_TOKEN}`,
                    filename: 'Bandage'
                },
                text
            );

            await this.bot.telegram.pinChatMessage(
                process.env.GROUP_ID!,
                message_o.message_id,
                { disable_notification: true }
            );
        } catch (e) {
            console.error(
                `Cannot do Telegram notification about https://pplbandage.ru/workshop/${bandage.externalId} (${e})`
            );
        }
    }
}
