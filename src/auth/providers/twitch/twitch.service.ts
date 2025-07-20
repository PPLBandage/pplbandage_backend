import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
import axios from 'axios';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses_users from 'src/localization/users.localization';
import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';

const cache_folder = process.env.CACHE_FOLDER + 'twitch/';

type TokenResponse = {
    access_token: string;
    expires_in: number;
    token_type: string;
};

type TwitchUserType = {
    id: string;
    login: string;
    display_name: string;
    profile_image_url?: string; // Is this possibly undefined?
};

@Injectable()
export class TwitchAuthService {
    constructor(
        private prisma: PrismaService,
        private authService: AuthService
    ) {}

    async getData(code: string, redirect_uri: string): Promise<TwitchUserType> {
        const token_response = await axios.post(
            'https://id.twitch.tv/oauth2/token',
            {
                code,
                client_id: process.env.TWITCH_CLIENT_ID,
                client_secret: process.env.TWITCH_CLIENT_SECRET,
                redirect_uri,
                grant_type: 'authorization_code'
            },
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                validateStatus: () => true
            }
        );

        if (token_response.status !== 200)
            throw new LocaleException(responses_users.INVALID_OAUTH_CODE, 404);

        const token_data = token_response.data as TokenResponse;
        const user_data_response = await axios.get(
            'https://api.twitch.tv/helix/users',
            {
                headers: {
                    Authorization: `Bearer ${token_data.access_token}`,
                    'Client-Id': process.env.TWITCH_CLIENT_ID
                },
                validateStatus: () => true
            }
        );

        if (user_data_response.status !== 200)
            throw new LocaleException(responses_users.PROFILE_FETCH_ERROR, 500);

        return user_data_response.data.data[0];
    }

    /** Update avatar cache */
    async updateAvatar(url?: string): Promise<string | null> {
        if (!url) return null;
        await this.initCacheFolders();

        const avatar_response = await axios.get(url, {
            responseType: 'arraybuffer'
        });

        if (avatar_response.status !== 200) return null;
        const avatar = Buffer.from(avatar_response.data);
        const filename = cache_folder + randomUUID();

        await writeFile(filename, avatar);
        return filename;
    }

    /** Delete avatar */
    deleteAvatar(path: string) {
        rm(path).catch(console.error);
    }

    /** Create cache folders for avatars */
    async initCacheFolders() {
        await mkdir(cache_folder, { recursive: true });
    }

    /** Create session for twitch user */
    async login(code: string, user_agent: string) {
        const data = await this.getData(
            code,
            process.env.TWITCH_MAIN_REDIRECT as string
        );
        const avatar_path = await this.updateAvatar(data.profile_image_url);

        const auth_record = await this.prisma.twitchAuth.findUnique({
            where: { uid: data.id },
            include: { user: { include: { UserSettings: true } } }
        });

        let user = undefined;
        if (!auth_record) {
            user = await this.authService.createUser({
                name: data.display_name || data.login,
                username: data.login.toLowerCase()
            });

            await this.prisma.twitchAuth.create({
                data: {
                    uid: data.id,
                    login: data.login,
                    name: data.display_name || data.login,

                    avatar_id: avatar_path,
                    user: { connect: { id: user.id } }
                }
            });
        } else {
            if (auth_record.avatar_id) this.deleteAvatar(auth_record.avatar_id);

            await this.prisma.twitchAuth.update({
                where: { id: auth_record.id },
                data: {
                    avatar_id: avatar_path,
                    login: data.login,
                    name: data.display_name || data.login
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

