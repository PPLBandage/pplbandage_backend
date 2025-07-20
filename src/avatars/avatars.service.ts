import { LocaleException } from 'src/interceptors/localization.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import responses from 'src/localization/users.localization';
import { readFile } from 'fs/promises';
import * as sharp from 'sharp';

export const avatar_providers = ['discord', 'google', 'twitch', 'minecraft'];

@Injectable()
export class AvatarsService {
    constructor(private prisma: PrismaService) {}

    /** Get user' preferred avatar */
    async getPreferredAvatar(uid: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: uid },
            include: {
                DiscordAuth: true,
                profile: true,
                GoogleAuth: true,
                TwitchAuth: true,
                UserSettings: true
            }
        });

        if (!user) throw new LocaleException(responses.USER_NOT_FOUND, 404);

        const user_prefer_avatar = user.UserSettings?.prefer_avatar || null;
        const check_order = [
            user_prefer_avatar,
            ...avatar_providers.filter(p => p !== user_prefer_avatar)
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

            if (provider === 'minecraft' && user.profile) {
                buff = await sharp(
                    Buffer.from(user.profile.data_head, 'base64')
                )
                    .resize(512, 512, { kernel: sharp.kernel.nearest })
                    .toFormat('png')
                    .toBuffer();
                break;
            }

            if (
                provider === 'google' &&
                user.GoogleAuth &&
                user.GoogleAuth.avatar_id
            ) {
                buff = await this.getAvatar(user.GoogleAuth.avatar_id);
                if (buff) break;
            }

            if (
                provider === 'twitch' &&
                user.TwitchAuth &&
                user.TwitchAuth.avatar_id
            ) {
                buff = await this.getAvatar(user.TwitchAuth.avatar_id);
                if (buff) break;
            }
        }

        return buff;
    }

    /** Read avatar from file */
    async getAvatar(avatar_id: string) {
        return readFile(avatar_id).catch(() => null);
    }

    /** Get user' discord avatar */
    async getDiscordAvatar(uid: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: uid },
            include: { DiscordAuth: true }
        });

        if (!user) throw new LocaleException(responses.USER_NOT_FOUND, 404);

        if (!user.DiscordAuth || !user.DiscordAuth.avatar_id)
            throw new LocaleException(responses.USER_NOT_FOUND, 404);

        const buff = await this.getAvatar(user.DiscordAuth.avatar_id);
        if (!buff) throw new LocaleException(responses.AVATAR_NOT_FOUND, 404);

        return buff;
    }

    /** Get user' minecraft avatar */
    async getMinecraftAvatar(uid: string) {
        const minecraft = await this.prisma.minecraft.findFirst({
            where: { userId: uid }
        });

        if (!minecraft)
            throw new LocaleException(responses.USER_NOT_FOUND, 404);

        const buff = Buffer.from(minecraft.data_head, 'base64');
        return await sharp(buff)
            .resize(512, 512, { kernel: sharp.kernel.nearest })
            .toFormat('png')
            .toBuffer();
    }

    /** Get user' google avatar */
    async getGoogleAvatar(uid: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: uid },
            include: { GoogleAuth: true }
        });

        if (!user) throw new LocaleException(responses.USER_NOT_FOUND, 404);

        if (!user.GoogleAuth || !user.GoogleAuth.avatar_id)
            throw new LocaleException(responses.USER_NOT_FOUND, 404);

        const buff = await this.getAvatar(user.GoogleAuth.avatar_id);
        if (!buff) throw new LocaleException(responses.AVATAR_NOT_FOUND, 404);

        return buff;
    }

    /** Get user' twitch avatar */
    async getTwitchAvatar(uid: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: uid },
            include: { TwitchAuth: true }
        });

        if (!user) throw new LocaleException(responses.USER_NOT_FOUND, 404);

        if (!user.TwitchAuth || !user.TwitchAuth.avatar_id)
            throw new LocaleException(responses.USER_NOT_FOUND, 404);

        const buff = await this.getAvatar(user.TwitchAuth.avatar_id);
        if (!buff) throw new LocaleException(responses.AVATAR_NOT_FOUND, 404);

        return buff;
    }
}

