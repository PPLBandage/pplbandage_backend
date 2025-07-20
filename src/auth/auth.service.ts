import { HttpException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    Bandage,
    Minecraft,
    User,
    UserSettings,
    Notifications,
    AccessRoles,
    Prisma
} from '@prisma/client';
import { sign, verify } from 'jsonwebtoken';
import { RolesEnum } from 'src/interfaces/types';
import { UAParser } from 'ua-parser-js';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses from 'src/localization/common.localization';
import { MinecraftService } from 'src/minecraft/minecraft.service';
import { slugify } from 'transliteration';

const EPOCH = 1672531200000n;

interface SessionToken {
    userId: number;
    access: number;
    iat: number;
    exp: number;
}

export interface Session {
    sessionId: string;
    cookie: string;
    user: UserFull;
}

export interface UserFull extends User {
    profile: Minecraft | null;
    UserSettings: UserSettings | null;
    Bandage: Bandage[];
    stars: Bandage[];
    notifications: Notifications[];
    AccessRoles: AccessRoles[];
    subscribers: User[];
    subscriptions: User[];
}

export interface UserAccess extends User {
    AccessRoles: AccessRoles[];
}

export const generateCookie = (session: string, exp: number): string => {
    /* generate cookie string */

    const date = new Date(exp * 1000);
    return `sessionId=${session}; Path=/; Expires=${date.toUTCString()}; SameSite=Strict`;
};

export const hasAccess = (
    user: UserFull | UserAccess | undefined,
    level: number,
    skipSuperAdmin?: boolean
) => {
    if (!user) return false;
    const user_roles = user.AccessRoles.map(role => role.level);
    return (
        user_roles.includes(level) ||
        (!skipSuperAdmin ? user_roles.includes(RolesEnum.SuperAdmin) : false)
    );
};

export const generateSnowflake = (increment: bigint, date?: Date): string => {
    const timestamp =
        BigInt(date ? new Date(date).getTime() : Date.now()) - EPOCH;
    const snowflake = (timestamp << 22n) | increment;
    return snowflake.toString();
};

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    constructor(
        private prisma: PrismaService,
        private readonly minecraftService: MinecraftService
    ) {}

    userInclude = {
        User: {
            include: {
                profile: true,
                notifications: true,
                UserSettings: true,
                Bandage: true,
                stars: true,
                AccessRoles: true,
                subscribers: true,
                subscriptions: true
            }
        }
    };

    filterUsername(username: string): string {
        return username.replace(/[^A-Za-z0-9_-]/g, '');
    }

    async createUser({
        name,
        username,
        ...extra
    }: {
        name: string;
        username: string;
    } & Omit<Prisma.UserCreateInput, 'name' | 'username' | 'id'>) {
        // NOT FOR PRODUCTION!!!
        // THIS CREATING TOO MANY DB REQUESTS

        // Normalize username
        let finalUsername = slugify(username, {
            lowercase: true,
            separator: '_'
        });

        let attempt = 0;
        while (
            await this.prisma.user.findFirst({
                where: { username: finalUsername }
            })
        ) {
            attempt++;
            finalUsername = username + '_'.repeat(attempt);
        }

        const users_count = await this.prisma.user.count();
        return await this.prisma.user.create({
            data: {
                id: generateSnowflake(BigInt(users_count)),
                username: this.filterUsername(finalUsername),
                name,
                UserSettings: { create: {} },
                AccessRoles: {
                    connect: { level: 0 }
                },
                ...extra
            },
            include: { UserSettings: true }
        });
    }

    async createSession(
        user: { id: string; UserSettings: { banned: boolean } | null },
        user_agent: string,
        roles: AccessRoles[]
    ) {
        if (user.UserSettings?.banned) {
            await this.prisma.sessions.deleteMany({
                where: { userId: user.id }
            });

            throw new LocaleException(responses.FORBIDDEN, 403);
        }

        const sessionId = sign(
            {
                userId: user.id,
                access: this.generateAccessBitSet(roles)
            },
            'ppl_super_secret',
            {
                expiresIn: Number(process.env.SESSION_TTL)
            }
        );

        const token_record = await this.prisma.sessions.create({
            data: {
                sessionId: sessionId,
                User_Agent: user_agent,
                User: { connect: { id: user.id } }
            }
        });
        return token_record;
    }

    generateAccessBitSet(roles: AccessRoles[]) {
        return roles.reduce((acc, role) => acc | (1 << role.level), 0);
    }

    async validateSession(
        session: string | undefined,
        user_agent: string,
        strict: boolean
    ): Promise<Session | undefined> {
        /* validate and update user session */

        if (!session) return undefined;

        this.logger.debug('Start session validating');
        const sessionDB = await this.prisma.sessions.findFirst({
            where: { sessionId: session },
            include: this.userInclude
        });

        this.logger.debug('Session info got (or not found)');
        if (!sessionDB) return undefined;

        // User-Agent check
        if (sessionDB.User_Agent !== user_agent) {
            try {
                await this.prisma.sessions.delete({
                    where: { id: sessionDB.id }
                });
            } finally {
                return undefined;
            }
        }

        try {
            const decoded = verify(session, 'ppl_super_secret') as SessionToken;
            const now = Math.round(Date.now() / 1000);
            const accessMatch =
                decoded.access ===
                this.generateAccessBitSet(sessionDB.User.AccessRoles);

            if (!strict && decoded.exp > now && accessMatch) {
                return {
                    sessionId: sessionDB.sessionId,
                    cookie: generateCookie(session, decoded.exp),
                    user: sessionDB.User
                };
            }

            if (
                decoded.iat + (decoded.exp - decoded.iat) / 2 < now ||
                !accessMatch // Если переданный юзером токен содержит старые роли - ревалидируем токен
            ) {
                const sessionId = sign(
                    {
                        userId: sessionDB.userId,
                        access: this.generateAccessBitSet(
                            sessionDB.User.AccessRoles
                        )
                    },
                    'ppl_super_secret',
                    { expiresIn: Number(process.env.SESSION_TTL) }
                );

                this.logger.debug('Updating session');
                const updatedSession = await this.prisma.sessions.update({
                    where: { id: sessionDB.id },
                    data: { sessionId: sessionId },
                    include: this.userInclude
                });
                this.logger.debug('Session updated');

                return {
                    sessionId: sessionId,
                    cookie: generateCookie(
                        sessionId,
                        now + Number(process.env.SESSION_TTL)
                    ),
                    user: updatedSession.User
                };
            }
            return {
                sessionId: sessionDB.sessionId,
                cookie: generateCookie(session, decoded.exp),
                user: sessionDB.User
            };
        } catch (err) {
            await this.prisma.sessions.delete({ where: { id: sessionDB.id } });
            console.error(`Failed to validate tokens: ${err} Exiting...`);
            return undefined;
        }
    }

    async logout(session: Session) {
        /* user log out */

        await this.prisma.sessions.delete({
            where: { sessionId: session.sessionId }
        });
    }

    async getSessions(session: Session) {
        /* Get user sessions */

        const sessions = await this.prisma.sessions.findMany({
            where: { userId: session.user.id }
        });

        return sessions.map(_session => {
            const user_agent = UAParser(_session.User_Agent);
            return {
                id: _session.id,
                last_accessed: _session.last_accessed,
                is_self: _session.sessionId === session.sessionId,
                is_mobile: ['mobile', 'tablet'].includes(
                    user_agent.device.type as string
                ),
                browser: user_agent.browser.name,
                browser_version: user_agent.browser.version
            };
        });
    }

    async deleteSession(session: Session, session_id: number) {
        const session_to_delete = await this.prisma.sessions.findFirst({
            where: { id: session_id }
        });
        if (!session_to_delete || session_to_delete.userId !== session.user.id)
            throw new HttpException('Session not found', 404);

        await this.prisma.sessions.delete({ where: { id: session_id } });
    }

    async deleteSessionAll(session: Session) {
        const sessions_to_delete = await this.prisma.sessions.findMany({
            where: { userId: session.user.id }
        });
        await Promise.all(
            sessions_to_delete.map(async _session => {
                if (_session.sessionId === session.sessionId) return;
                await this.prisma.sessions.delete({
                    where: { id: _session.id }
                });
            })
        );
    }
}

