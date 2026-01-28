import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses_users from 'src/localization/users.localization';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
import { mkdir, rm, writeFile } from 'fs/promises';
import * as crypto from 'crypto';
import { join } from 'path';

interface TelegramUser {
    id: number;
    first_name: string;
    username: string;
    photo_url?: string;
    auth_date?: number;
    hash?: string;
}

@Injectable()
export class TelegramAuthService {
    constructor(
        private prisma: PrismaService,
        private authService: AuthService
    ) {}

    /** Get user data by code */
    async getData(code: string): Promise<TelegramUser> {
        const decoded = Buffer.from(code, 'base64');
        const user_data: TelegramUser = JSON.parse(decoded.toString('utf-8'));

        const data_check = (Object.keys(user_data) as Array<keyof TelegramUser>)
            .filter(
                (k): k is Exclude<keyof TelegramUser, 'hash'> => k !== 'hash'
            )
            .sort()
            .map(k => `${k}=${user_data[k]}`)
            .join('\n');

        const secretKey = crypto
            .createHash('sha256')
            .update(process.env.TELEGRAM_BOT_TOKEN!)
            .digest();

        const hmac = crypto
            .createHmac('sha256', secretKey)
            .update(data_check)
            .digest('hex');

        if (hmac !== user_data.hash)
            throw new LocaleException(responses_users.PROFILE_FETCH_ERROR, 400);

        const authDate = parseInt(String(user_data.auth_date));
        const now = Math.floor(Date.now() / 1000);
        if (now - authDate > 86400)
            throw new LocaleException(responses_users.PROFILE_FETCH_ERROR, 400);

        return user_data;
    }

    /** Update avatar cache */
    async updateAvatar(url?: string): Promise<string | null> {
        if (!url) return null;
        await this.initCacheFolders();

        const avatar_response = await axios.get(url, {
            responseType: 'arraybuffer',
            validateStatus: () => true
        });

        if (avatar_response.status !== 200) return null;
        const avatar = Buffer.from(avatar_response.data);
        const filename = join(
            process.env.CACHE_FOLDER!,
            'telegram',
            crypto.randomUUID()
        );

        await writeFile(filename, avatar);
        return filename;
    }

    deleteAvatar(path: string) {
        rm(path).catch(console.error);
    }

    /** Create cache folders for avatars */
    async initCacheFolders() {
        await mkdir(join(process.env.CACHE_FOLDER!, 'telegram'), {
            recursive: true
        });
    }

    /** Create session for telegram user */
    async login(code: string, user_agent: string) {
        const data = await this.getData(code);
        const avatar_path = await this.updateAvatar(data.photo_url);

        const auth_record = await this.prisma.telegramAuth.findUnique({
            where: { telegram_id: data.id.toString() },
            include: { user: { include: { UserSettings: true } } }
        });

        let user = undefined;
        const name = data.first_name || data.username || data.id.toString();
        if (!auth_record) {
            user = await this.authService.createUser({
                name: name,
                username: data.username ?? name.toLowerCase()
            });

            await this.prisma.telegramAuth.create({
                data: {
                    telegram_id: data.id.toString(),
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
            user_roles,
            'telegram'
        );
    }
}
