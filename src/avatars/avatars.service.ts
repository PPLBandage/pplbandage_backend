import { LocaleException } from 'src/interceptors/localization.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import responses from 'src/localization/users.localization';
import { readFile } from 'fs/promises';

@Injectable()
export class AvatarsService {
    providers = ['discord', 'bla', 'bla-bla'];
    constructor(private prisma: PrismaService) {}

    /** Get user' preferred avatar */
    async getPreferredAvatar(uid: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: uid },
            include: { DiscordAuth: true }
        });

        if (!user) throw new LocaleException(responses.USER_NOT_FOUND, 404);

        const preferred = 'discord'; // Условность
        const check_order = [
            preferred,
            ...this.providers.filter(p => p !== preferred)
        ];

        let buff = null;
        for (const provider of check_order) {
            if (
                provider === 'discord' &&
                user.DiscordAuth &&
                user.DiscordAuth.avatar_id
            ) {
                buff = await this.getAvatar(user.DiscordAuth.avatar_id);
                if (buff) break;
            }
        }

        return buff;
    }

    /** Get user' avatar */
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

        const buff = await this.getAvatar(user.DiscordAuth.avatar_id);
        if (!buff) throw new LocaleException(responses.AVATAR_NOT_FOUND, 404);

        return buff;
    }

    /** Read avatar from file */
    async getAvatar(avatar_id: string) {
        return readFile(avatar_id).catch(() => null);
    }
}

