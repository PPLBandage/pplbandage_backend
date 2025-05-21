import { Injectable } from '@nestjs/common';
import axios from 'axios';

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
}
