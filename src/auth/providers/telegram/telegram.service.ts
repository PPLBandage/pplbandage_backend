import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses_users from 'src/localization/users.localization';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
import { mkdir, rm, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';

const cache_folder = process.env.CACHE_FOLDER + 'telegram/';

interface TelegramUser {
    id: string;
    first_name: string;
    last_name?: string;
    username?: string;
}

@Injectable()
export class TelegramAuthService {
    constructor(
        private prisma: PrismaService,
        private authService: AuthService
    ) {}

    /** Get user data by code */
    async getData(code: string): Promise<TelegramUser> {
        // ----------------------- Get access token -------------------------------
        const telegram_data = await axios.post(
            `${process.env.TELEGRAM_API_URL}/code`,
            {
                token: process.env.TELEGRAM_SECRET,
                code: code
            },
            {
                validateStatus: () => true
            }
        );

        console.log(telegram_data.status);
        console.log(telegram_data.data);

        if (telegram_data.status !== 201)
            throw new LocaleException(responses_users.INVALID_OAUTH_CODE, 404);

        return telegram_data.data;
    }

    /** Update avatar cache */
    async updateAvatar(uid?: string): Promise<string | null> {
        if (!uid) return null;
        await this.initCacheFolders();

        const avatar_response = await axios.get(
            `${process.env.TELEGRAM_API_URL}/avatar/${uid}`,
            { responseType: 'arraybuffer' }
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

    /** Create session for telegram user */
    async login(code: string, user_agent: string) {
        const data = await this.getData(code);
        const avatar_path = await this.updateAvatar(data.id);

        const auth_record = await this.prisma.telegramAuth.findUnique({
            where: { telegram_id: data.id },
            include: { user: { include: { UserSettings: true } } }
        });

        let user = undefined;
        const name = data.first_name || data.username || data.id;
        if (!auth_record) {
            user = await this.authService.createUser({
                name: name,
                username: data.username ?? name.toLowerCase()
            });

            await this.prisma.telegramAuth.create({
                data: {
                    telegram_id: data.id,
                    name: name,
                    login: data.username,
                    avatar_id: avatar_path,
                    user: { connect: { id: user.id } }
                }
            });
        } else {
            if (auth_record.avatar_id) this.deleteAvatar(auth_record.avatar_id);

            await this.prisma.telegramAuth.update({
                where: { id: auth_record.id },
                data: {
                    name: name,
                    login: data.username,
                    avatar_id: avatar_path
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
