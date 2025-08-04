import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses_users from 'src/localization/users.localization';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';

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
            process.env.TELEGRAM_API_URL as string,
            {
                token: process.env.TELEGRAM_SECRET,
                code: code
            },
            {
                validateStatus: () => true
            }
        );

        if (telegram_data.status !== 201)
            throw new LocaleException(responses_users.INVALID_OAUTH_CODE, 404);

        return telegram_data.data;
    }

    /** Create session for discord user */
    async login(code: string, user_agent: string) {
        const data = await this.getData(code);

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
                    user: { connect: { id: user.id } }
                }
            });
        } else {
            await this.prisma.telegramAuth.update({
                where: { id: auth_record.id },
                data: {
                    name: name,
                    login: data.username
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
