// Перенос провайдеров логина в отдельные таблицы

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';

const prisma = new PrismaClient();

const main = async () => {
    await prisma.$connect();
    await mkdir(process.env.CACHE_FOLDER as string, { recursive: true });

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

            if (avatar_response.status !== 200) return null;
            const avatar = Buffer.from(avatar_response.data);
            filename = process.env.CACHE_FOLDER + randomUUID();

            await writeFile(filename, avatar);
        } else {
            has_avatar = false;
        }

        await prisma.discordAuth.create({
            data: {
                discord_id: user.discordId,
                avatar_id: has_avatar ? filename : undefined,
                userid: user.id
            }
        });

        console.log(`Processed user ${user.name}`);
    }
};

main()
    .then(() => console.log('Success'))
    .catch(console.error);

