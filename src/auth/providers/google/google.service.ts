import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
import axios from 'axios';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses_users from 'src/localization/users.localization';
import { decode } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';

const cache_folder = process.env.CACHE_FOLDER + 'google/';

type TokenResponse = {
    access_token: string;
    expires_in: number;
    token_type: string;
    id_token: string;
};

type GoogleIdTokenPayload = {
    sub: string;
    email: string;

    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
};

@Injectable()
export class GoogleAuthService {
    constructor(
        private prisma: PrismaService,
        private authService: AuthService
    ) {}

    async getData(code: string, redirect_uri: string) {
        const token_response = await axios.post(
            'https://oauth2.googleapis.com/token',
            {
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri,
                grant_type: 'authorization_code'
            },
            {
                validateStatus: () => true
            }
        );

        if (token_response.status !== 200)
            throw new LocaleException(responses_users.INVALID_OAUTH_CODE, 404);

        const token_data = token_response.data as TokenResponse;
        return decode(token_data.id_token) as GoogleIdTokenPayload;
    }

    resizeGoogleAvatarUrl(url: string, size: number = 512): string {
        return url.replace(/=s\d+(-[a-z]*)?/, `=s${size}$1`);
    }

    /** Update avatar cache */
    async updateAvatar(url?: string): Promise<string | null> {
        if (!url) return null;
        await this.initCacheFolders();

        const avatar_response = await axios.get(
            this.resizeGoogleAvatarUrl(url, 512),
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

    /** Get account name */
    getName(payload: GoogleIdTokenPayload): string {
        if (payload.name && payload.name.trim()) {
            return payload.name.trim();
        }

        const given = payload.given_name?.trim() || '';
        const family = payload.family_name?.trim() || '';

        if (given || family) {
            return `${given} ${family}`.trim();
        }

        throw new LocaleException(responses_users.USER_NO_NAME, 400);
    }

    /** Mask email (circumventing laws))) */
    maskEmail(email: string): string {
        const [user, domain] = email.split('@');

        switch (user.length) {
            case 1:
                return `*@${domain}`;
            case 2:
                return `${user[0]}*@${domain}`;
            case 3:
                return `${user[0]}*${user[2]}@${domain}`;
            case 4:
                return `${user.slice(0, 2)}*${user[3]}@${domain}`;
            default:
                const start = user.slice(0, 2);
                const end = user.slice(-2);
                const masked = '*'.repeat(user.length - 4);
                return `${start}${masked}${end}@${domain}`;
        }
    }

    /** Create session for google user */
    async login(code: string, user_agent: string) {
        const data = await this.getData(
            code,
            process.env.GOOGLE_MAIN_REDIRECT as string
        );
        const avatar_path = await this.updateAvatar(data.picture);
        const name = this.getName(data);

        const auth_record = await this.prisma.googleAuth.findUnique({
            where: { sub: data.sub },
            include: { user: { include: { UserSettings: true } } }
        });

        let user = undefined;
        if (!auth_record) {
            user = await this.authService.createUser({
                name: name,
                username: name.toLowerCase()
            });

            await this.prisma.googleAuth.create({
                data: {
                    sub: data.sub,
                    email: this.maskEmail(data.email),
                    name,

                    avatar_id: avatar_path,
                    user: { connect: { id: user.id } }
                }
            });
        } else {
            if (auth_record.avatar_id) this.deleteAvatar(auth_record.avatar_id);

            await this.prisma.googleAuth.update({
                where: { id: auth_record.id },
                data: {
                    avatar_id: avatar_path,
                    name
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
