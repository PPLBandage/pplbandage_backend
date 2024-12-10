import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Bandage, Minecraft, User, UserSettings, Notifications, AccessRoles } from '@prisma/client';
import { sign, verify } from 'jsonwebtoken';
import axios from 'axios';
import { RolesEnum } from 'src/interfaces/types';
import { UserService } from 'src/user/user.service';
import { UAParser } from 'ua-parser-js'

const discord_url = process.env.DISCORD_URL + "/api/v10";
const pwgood = "447699225078136832";  // pwgood server id
const EPOCH = 1672531200000n;

interface DiscordResponse {
    token_type: string,
    access_token: string,
    expires_in: number,
    refresh_token: string,
    scope: string
}

interface DiscordUser {
    id: string,
    username: string,
    avatar: string | null,
    discriminator: string,
    public_flags: number,
    flags: number,
    banner: string | null,
    accent_color: number,
    global_name: string | null,
    avatar_decoration_data: number | null,
    banner_color: string | null,
    clan: string | null,
    mfa_enabled: boolean,
    locale: string,
    premium_type: number
}

interface SessionToken {
    userId: number,
    iat: number,
    exp: number
}

interface PepelandResponse {
    roles: string[],
    user: {
        id: string,
        username: string
    }
}

export interface Session {
    sessionId: string;
    cookie: string;
    user: UserFull;
}


export interface UserFull extends User {
    profile: Minecraft | null,
    UserSettings: UserSettings | null,
    Bandage: Bandage[],
    stars: Bandage[],
    notifications: Notifications[],
    AccessRoles: AccessRoles[]
}

export interface UserAccess extends User {
    AccessRoles: AccessRoles[]
}

const generateCookie = (session: string, exp: number): string => {
    /* generate cookie string */

    const date = new Date(exp * 1000);
    return `sessionId=${session}; Path=/; Expires=${date.toUTCString()}; SameSite=Strict`;
}

export const hasAccess = (user: UserFull | UserAccess | undefined, level: number, skipSuperAdmin?: boolean) => {
    if (!user) return false;
    const user_roles = user.AccessRoles.map(role => role.level);
    return user_roles.includes(level) || (!skipSuperAdmin ? user_roles.includes(RolesEnum.SuperAdmin) : false);
}

export const generateSnowflake = (increment: bigint, date?: Date): string => {
    const timestamp = BigInt(date ? new Date(date).getTime() : Date.now()) - EPOCH;
    const snowflake = (timestamp << 22n) | increment;
    return snowflake.toString();
}


@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService,
        private readonly userService: UserService
    ) { }

    async getRoles() {
        return (await this.prisma.roles.findMany()).reverse();
    }

    async check_ppl(token: string) {
        /* check user on pwgood server */

        const response = await axios.get(`${discord_url}/users/@me/guilds/${pwgood}/member`, {
            headers: {
                Authorization: token
            },
            validateStatus: () => true
        });
        if (response.status != 200) {
            return false;
        }
        const data = response.data as PepelandResponse;
        const roles = (await this.getRoles()).map(role => role.ds_id);

        return data.roles.some(role => roles.includes(role));
    }

    async login(code: string, user_agent: string) {
        /* log in by code */

        const redirect_url = new URL(decodeURI(process.env.LOGIN_URL as string));

        // ----------------------- Get access token -------------------------------
        const discord_tokens = await axios.post(discord_url + "/oauth2/token", {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_url.searchParams.get('redirect_uri')
        }, {
            headers: {
                'Authorization': `Basic ${process.env.BASIC_AUTH}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            validateStatus: () => true
        });
        if (discord_tokens.status !== 200) {
            return {
                statusCode: 404,
                message: 'Invalid code',
                message_ru: 'Недействительный код. Попробуйте еще раз'
            };
        }
        const data = discord_tokens.data as DiscordResponse;

        // ----------------------- Get discord user data --------------------------

        const discord_user = await axios.get(discord_url + "/users/@me", {
            headers: {
                'Authorization': `${data.token_type} ${data.access_token}`
            }, validateStatus: () => true
        });

        if (discord_user.status !== 200) {
            return {
                statusCode: 500,
                message: 'Error retrieving user data',
                message_ru: 'Ошибка при получении данных пользователя'
            };
        }
        const ds_user = discord_user.data as DiscordUser;

        // ----------------------- Check discord server roles ---------------------

        const user_settings = await this.prisma.userSettings.findFirst({ where: { User: { discordId: ds_user.id } } });
        const on_ppl = await this.check_ppl(`${data.token_type} ${data.access_token}`);
        if (!on_ppl && !user_settings?.skip_ppl_check) {
            await this.prisma.sessions.deleteMany({ where: { User: { discordId: ds_user.id } } });
            return {
                statusCode: 403,
                message: 'You are not on ppl',
                message_ru: 'У вас нет требуемых ролей для регистрации'
            };
        }

        // ----------------------- Upsert user field in DB ------------------------

        const users_count = await this.prisma.user.count();
        const user_db = await this.prisma.user.upsert({
            where: { discordId: ds_user.id },
            create: {
                id: generateSnowflake(BigInt(users_count)),
                discordId: ds_user.id,
                username: ds_user.username,
                name: ds_user.global_name || ds_user.username,
                UserSettings: { create: {} },
                AccessRoles: {
                    connect: { level: 0 }
                }
            },
            update: {},
            include: { UserSettings: true }
        });

        await this.userService.resolveCollisions(user_db.username);

        if (user_db.UserSettings?.banned) {
            await this.prisma.sessions.deleteMany({ where: { userId: user_db.id } });
            return {
                statusCode: 403,
                message: 'Unable to login',
                message_ru: 'Невозможно получить доступ к профилю'
            };
        }

        // ----------------------- Create session token ---------------------------

        const session = await this.createSession(user_db.id, user_agent);
        return {
            statusCode: 200,
            message: 'Logged in',
            message_ru: 'Вход произведен успешно',
            sessionId: session.sessionId,
        };
    }


    async createSession(user_id: string, user_agent: string) {
        const sessionId = sign({ userId: user_id }, 'ppl_super_secret', { expiresIn: Number(process.env.SESSION_TTL) });
        const token_record = await this.prisma.sessions.create({
            data: {
                sessionId: sessionId,
                User_Agent: user_agent,
                User: {
                    connect: {
                        id: user_id
                    }
                }
            }
        });
        return token_record;
    }

    async validateSession(session: string | undefined, user_agent: string): Promise<Session | null> {
        /* validate and update user session */

        if (!session) return null;

        const userInclude = {
            User: {
                include: {
                    profile: true,
                    notifications: true,
                    UserSettings: true,
                    Bandage: true,
                    stars: true,
                    AccessRoles: true,
                },
            },
        };

        const sessionDB = await this.prisma.sessions.findFirst({
            where: { sessionId: session },
            include: userInclude
        });

        if (!sessionDB) return null;

        // User-Agent check
        if (sessionDB.User_Agent !== user_agent) {
            try {
                await this.prisma.sessions.delete({ where: { id: sessionDB.id } });
            } finally {
                return null;
            }
        }

        try {
            const decoded = verify(session, 'ppl_super_secret') as SessionToken;
            const now = Math.round(Date.now() / 1000);
            if (decoded.iat + ((decoded.exp - decoded.iat) / 2) < now) {
                const sessionId = sign({ userId: sessionDB.userId }, 'ppl_super_secret', { expiresIn: Number(process.env.SESSION_TTL) });

                const updatedSession = await this.prisma.sessions.update({
                    where: { id: sessionDB.id },
                    data: { sessionId: sessionId },
                    include: userInclude
                });

                return {
                    sessionId: sessionId,
                    cookie: generateCookie(sessionId, now + Number(process.env.SESSION_TTL)),
                    user: updatedSession.User
                }
            }
            return {
                sessionId: sessionDB.sessionId,
                cookie: generateCookie(session, decoded.exp),
                user: sessionDB.User
            }
        } catch (err) {
            await this.prisma.sessions.delete({ where: { id: sessionDB.id } });
            console.error(`Failed to validate tokens: ${err} Exiting...`);
            return null;
        }
    }


    async logout(session: Session) {
        /* user log out */

        await this.prisma.sessions.delete({ where: { sessionId: session.sessionId } });
    }


    async getSessions(session: Session) {
        /* Get user sessions */

        const sessions = await this.prisma.sessions.findMany({ where: { userId: session.user.id } });

        return sessions.map(_session => {
            const user_agent = UAParser(_session.User_Agent);
            return {
                id: _session.id,
                last_accessed: _session.last_accessed,
                is_self: _session.sessionId === session.sessionId,
                is_mobile: ['mobile', 'tablet'].includes(user_agent.device.type as string),
                browser: user_agent.browser.name,
                browser_version: user_agent.browser.version
            }
        })
    }

    async deleteSession(session: Session, session_id: number) {
        const session_to_delete = await this.prisma.sessions.findFirst({ where: { id: session_id } });
        if (!session_to_delete || session_to_delete.userId !== session.user.id) {
            return {
                statusCode: 404,
                message: 'Not found',
                message_ru: 'Сессия не найдена'
            }
        }

        await this.prisma.sessions.delete({ where: { id: session_id } });
        return {
            statusCode: 200,
            message: 'Logged out',
            message_ru: 'Вы успешно вышли из аккаунта'
        }
    }

    async deleteSessionAll(session: Session) {
        const sessions_to_delete = await this.prisma.sessions.findMany({ where: { userId: session.user.id } });
        await Promise.all(sessions_to_delete.map(async _session => {
            if (_session.sessionId === session.sessionId) return;
            await this.prisma.sessions.delete({ where: { id: _session.id } });
        }));

        return {
            statusCode: 200,
            message: 'Logged out',
            message_ru: 'Вы успешно вышли со всех устройств'
        }

    }
}

