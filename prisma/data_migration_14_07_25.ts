// Перенос провайдеров логина в отдельные таблицы

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';

const prisma = new PrismaClient();
const cache_folder = process.env.CACHE_FOLDER + 'discord/';

const main = async () => {
    await prisma.$connect();
    await mkdir(cache_folder, { recursive: true });

    const users = await prisma.user.findMany({
        include: { DiscordAuth: true }
    });

    for (const user of users) {
        if (user.DiscordAuth) continue;

        const response = await axios.get(
            `${process.env.DISCORD_URL}/users/${user.discordId}`,
            {
                headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
                validateStatus: () => true
            }
        );

        let has_avatar = true;
        let filename;
        if (response.data.avatar) {
            const avatar_response = await axios.get(
                `${process.env.DISCORD_AVATAR}/${user.discordId}/${response.data.avatar}.png?size=512`,
                { responseType: 'arraybuffer' }
            );

            if (avatar_response.status === 200) {
                const avatar = Buffer.from(avatar_response.data);
                filename = cache_folder + randomUUID();

                await writeFile(filename, avatar);
            } else {
                console.error(avatar_response.data);
            }
        } else {
            has_avatar = false;
        }

        await prisma.discordAuth.create({
            data: {
                discord_id: user.discordId,
                avatar_id: has_avatar ? filename : undefined,
                name: response.data.global_name ?? response.data.username,
                connected_at: user.joined_at,
                userid: user.id
            }
        });

        console.log(`Processed user ${user.name}`);
    }
};

main()
    .then(() => console.log('Success'))
    .catch(console.error);

