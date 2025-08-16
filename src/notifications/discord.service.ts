import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { BandageFull } from 'src/common/bandage_response';

const discord_url = process.env.DISCORD_URL;

@Injectable()
export class DiscordNotificationService {
    constructor() {}

    async doNotification(content: string, embeds?: object[], channel?: string) {
        await axios.post(
            `${discord_url}/channels/${channel || process.env.MODERATION_CHANNEL_ID}/messages`,
            {
                content: content,
                embeds
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
        bandage_tags?: string[]
    ) {
        try {
            const tags =
                bandage_tags ?? bandage.tags?.map?.(tag => tag.name) ?? [];

            const embed = {
                title: message,
                description:
                    `## [${bandage.title}](${process.env.DOMAIN}/workshop/${bandage.externalId})\n` +
                    `${bandage.description || '<нет описания>'}`,
                color: parseInt(bandage.accent_color.replace('#', ''), 16),
                fields: [
                    {
                        name: 'Теги',
                        value: `\`${tags.join('`, `')}\``
                    },
                    {
                        name: 'Имеет раздельные типы',
                        value: bandage.split_type ? 'Да' : 'Нет'
                    }
                ],
                author: {
                    name: bandage.User.name,
                    url: `${process.env.DOMAIN}/users/${bandage.User.username}`
                },
                footer: {
                    text: new Date(bandage.creationDate).toLocaleString()
                },
                image: {
                    url: `${process.env.DOMAIN}/api/v1/workshop/${bandage.externalId}/og?token=${process.env.WORKSHOP_TOKEN}`
                }
            };

            await this.doNotification(`<@&${process.env.MENTION_ROLE_ID}>`, [
                embed
            ]);
        } catch (e) {
            console.error(
                `Cannot do Discord notification about https://pplbandage.ru/workshop/${bandage.externalId} (${e})`
            );
        }
    }
}
