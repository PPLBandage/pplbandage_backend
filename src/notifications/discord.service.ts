import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Session } from 'src/auth/auth.service';
import { BandageFull } from 'src/common/bandage_response';

const discord_url = process.env.DISCORD_URL;

@Injectable()
export class DiscordNotificationService {
    constructor() {}

    async doNotification(content: string, channel?: string) {
        await axios.post(
            `${discord_url}/channels/${channel || process.env.MODERATION_CHANNEL_ID}/messages`,
            {
                content: content
            },
            {
                validateStatus: () => true,
                headers: {
                    Authorization: `Bot ${process.env.BOT_TOKEN}`
                }
            }
        );
    }

    async doBandageNotification(
        message: string,
        bandage: BandageFull,
        session: Session,
        bandage_tags?: string[]
    ) {
        try {
            const tags =
                bandage_tags ?? bandage.tags?.map?.(tag => tag.name) ?? [];
            await this.doNotification(
                `<@&${process.env.MENTION_ROLE_ID}> ${message}\n` +
                    `- **Название**: ${bandage.title}\n` +
                    `- **Описание**: ${bandage.description || '<нет описания>'}\n` +
                    `- **Имеет раздельные типы**: ${bandage.split_type ? 'Да' : 'Нет'}\n` +
                    `- **Теги**: \`${tags.join('`, `')}\`\n` +
                    `- **Создатель**: ${session.user.name}\n\n` +
                    `**URL**: https://pplbandage.ru/workshop/${bandage.externalId}`
            );
        } catch (e) {
            console.error(
                `Cannot do Discord notification about https://pplbandage.ru/workshop/${bandage.externalId} (${e})`
            );
        }
    }
}

