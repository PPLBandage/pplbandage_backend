import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses_users from 'src/localization/users.localization';
import { PrismaService } from 'src/prisma/prisma.service';
import { mkdir, writeFile, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import { AuthService } from 'src/auth/auth.service';

const discord_url = process.env.DISCORD_URL;
const cache_folder = process.env.CACHE_FOLDER + 'discord/';

interface DiscordResponse {
    token_type: string;
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
}

interface DiscordUser {
    id: string;
    username: string;
    avatar: string | null;
    discriminator: string;
    public_flags: number;
    flags: number;
    banner: string | null;
    accent_color: number;
    global_name: string | null;
    avatar_decoration_data: number | null;
    banner_color: string | null;
    clan: string | null;
    mfa_enabled: boolean;
    locale: string;
    premium_type: number;
}

@Injectable()
export class DiscordAuthService {
    constructor(
        private prisma: PrismaService,
        private authService: AuthService
    ) {}

    /** Get user data by code */
    async getData(code: string, redirect_uri: string): Promise<DiscordUser> {
        // ----------------------- Get access token -------------------------------
        const discord_tokens = await axios.post(
            discord_url + '/oauth2/token',
            {
                grant_type: 'authorization_code',
                code: code,
                redirect_uri
            },
            {
                headers: {
                    Authorization: `Basic ${process.env.BASIC_AUTH}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                validateStatus: () => true
            }
        );
        if (discord_tokens.status !== 200)
            throw new LocaleException(responses_users.INVALID_OAUTH_CODE, 404);

        const tokens_data = discord_tokens.data as DiscordResponse;

        // ----------------------- Get discord user data --------------------------

        const discord_user = await axios.get(discord_url + '/users/@me', {
            headers: {
                Authorization: `${tokens_data.token_type} ${tokens_data.access_token}`
            },
            validateStatus: () => true
        });

        if (discord_user.status !== 200)
            throw new LocaleException(responses_users.PROFILE_FETCH_ERROR, 500);

        return discord_user.data;
    }

    /** Update avatar cache */
    async updateAvatar(
        avatar_hash: string | null,
        user_id: string
    ): Promise<string | null> {
        if (!avatar_hash) return null;
        await this.initCacheFolders();

        const avatar_response = await axios.get(
            `${process.env.DISCORD_AVATAR}/${user_id}/${avatar_hash}.png?size=512`,
            { responseType: 'arraybuffer', validateStatus: () => true }
        );

        if (avatar_response.status !== 200) return null;
        const avatar = Buffer.from(avatar_response.data);
        const filename = cache_folder + randomUUID();

        await writeFile(filename, avatar);
        return filename;
    }

    deleteAvatar(path: string) {
        rm(path).catch(console.error);
    }

    /** Create cache folders for avatars */
    async initCacheFolders() {
        await mkdir(cache_folder, { recursive: true });
    }

    /** Create session for discord user */
    async login(code: string, user_agent: string) {
        const data = await this.getData(
            code,
            process.env.DISCORD_MAIN_REDIRECT as string
        );
        const avatar_path = await this.updateAvatar(data.avatar, data.id);

        const auth_record = await this.prisma.discordAuth.findUnique({
            where: { discord_id: data.id },
            include: { user: { include: { UserSettings: true } } }
        });

        let user = undefined;
        if (!auth_record) {
            user = await this.authService.createUser({
                name: data.global_name ?? data.username,
                username: data.username
            });

            await this.prisma.discordAuth.create({
                data: {
                    discord_id: data.id,
                    avatar_id: avatar_path,
                    name: data.global_name ?? data.username,
                    username: data.username,
                    user: { connect: { id: user.id } }
                }
            });
        } else {
            if (auth_record.avatar_id) this.deleteAvatar(auth_record.avatar_id);

            await this.prisma.discordAuth.update({
                where: { id: auth_record.id },
                data: {
                    avatar_id: avatar_path,
                    name: data.global_name ?? data.username
                }
            });

            user = auth_record.user;
        }

        const user_roles = await this.prisma.accessRoles.findMany({
            where: { users: { some: { id: user.id } } }
        });
        return await this.authService.createSession(
            user,
            user_agent,
            user_roles
        );
    }
}
