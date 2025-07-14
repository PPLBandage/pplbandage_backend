import { LocaleException } from 'src/interceptors/localization.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import responses from 'src/localization/users.localization';
import { readFile } from 'fs/promises';

@Injectable()
export class AvatarsService {
    constructor(private prisma: PrismaService) {}

    async getPreferredAvatar(uid: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: uid },
            include: { DiscordAuth: true }
        });

        if (!user) throw new LocaleException(responses.USER_NOT_FOUND, 404);

        let buff = null;
        if (user.DiscordAuth && user.DiscordAuth.avatar_id) {
            buff = this.getDiscordAvatarFile(user.DiscordAuth.avatar_id);
        }

        return buff;
    }

    async getDiscordAvatar(uid: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: uid },
            include: { DiscordAuth: true }
        });

        if (!user) throw new LocaleException(responses.USER_NOT_FOUND, 404);

        if (!user.DiscordAuth || !user.DiscordAuth.avatar_id)
            throw new LocaleException(
                'Discord auth not connected or no avatar set on this account',
                404
            );

        const buff = await this.getDiscordAvatarFile(
            user.DiscordAuth.avatar_id
        );
        if (!buff) throw new LocaleException(responses.AVATAR_NOT_FOUND, 404);

        return buff;
    }

    async getDiscordAvatarFile(avatar_id: string) {
        return readFile(avatar_id).catch(() => null);
    }
}

