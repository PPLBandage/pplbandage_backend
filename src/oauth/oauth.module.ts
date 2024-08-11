import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Bandage, Minecraft, User, UserSettings, Notifications, AccessRoles } from '@prisma/client';
import { sign, verify } from 'jsonwebtoken';
import axios from 'axios';

const discord_url = "https://discord.com/api/v10";
const pwgood = "447699225078136832";  // pwgood server id

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
    AccessRoles: AccessRoles | null
}

const generateCookie = (session: string, exp: number): string => {
    /* generate cookie string */

    const date = new Date(exp * 1000);
    return `sessionId=${session}; Path=/; Expires=${date.toUTCString()}; SameSite=Strict`;
}

export const hasAccess = (user: UserFull, level: number) =>
    user.AccessRoles?.level ? user.AccessRoles.level >= level : level === 0;


@Injectable()
export class OauthService {
    constructor(private prisma: PrismaService) { }

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
        const roles = (await this.getRoles()).map((role) => role.ds_id);
        for (const role of data.roles) {
            if (roles.includes(role)) {
                return true;
            }
        }
        return false;
    }

    async login(code: string, user_agent: string) {
        /* log in by code */

        const discord_tokens = await axios.post(discord_url + "/oauth2/token", {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': process.env.REDIRECT_URI
        }, {
            headers: {
                'Authorization': `Basic ${process.env.BASIC_AUTH}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }, validateStatus: () => true
        });
        if (discord_tokens.status !== 200) return null;
        const data = discord_tokens.data as DiscordResponse;

        const discord_user = await axios.get(discord_url + "/users/@me", {
            headers: {
                'Authorization': `${data.token_type} ${data.access_token}`
            }, validateStatus: () => true
        });

        if (discord_user.status !== 200) return null;
        const ds_user = discord_user.data as DiscordUser;

        const on_ppl = await this.check_ppl(`${data.token_type} ${data.access_token}`);
        if (!on_ppl) {
            await this.prisma.sessions.deleteMany({ where: { User: { discordId: ds_user.id } } });
            return { message: "You are not on ppl", statusCode: 403 };
        }

        const user_db = await this.prisma.user.upsert({
            where: { discordId: ds_user.id },
            create: {
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
        if (user_db.UserSettings?.banned) {
            await this.prisma.sessions.deleteMany({ where: { userId: user_db.id } });
            return { message: "Unable to login", statusCode: 403 };
        }

        const sessionId = sign({ userId: user_db.id }, 'ppl_super_secret', { expiresIn: Number(process.env.SESSION_TTL) });
        const token_record = await this.prisma.sessions.create({
            data: {
                sessionId: sessionId,
                User_Agent: user_agent,
                User: {
                    connect: {
                        id: user_db.id
                    }
                }
            }
        });
        return { message: "logged in", sessionId: token_record.sessionId, statusCode: 200 };
    }

    async validateSession(session: string | undefined, user_agent: string): Promise<Session | null> {
        /* validate and update user session */

        if (!session) return null;
        const sessionDB = await this.prisma.sessions.findFirst({
            where: { sessionId: session },
            include: {
                User: {
                    include: {
                        profile: true,
                        notifications: true,
                        UserSettings: true,
                        Bandage: true,
                        stars: true,
                        AccessRoles: true
                    }
                }
            }
        });
        if (!sessionDB) return null;

        if (sessionDB.User_Agent !== user_agent) {
            try {
                await this.prisma.sessions.delete({ where: { id: sessionDB.id } });
            } finally {
                return null;
            }
        }

        try {
            const decoded = verify(session, 'ppl_super_secret') as SessionToken;
            const seconds = Math.round(Date.now() / 1000);
            if (decoded.iat + ((decoded.exp - decoded.iat) / 2) < seconds) {
                const sessionId = sign({ userId: sessionDB.userId }, 'ppl_super_secret', { expiresIn: Number(process.env.SESSION_TTL) });
                const new_tokens = await this.prisma.sessions.update({
                    where: { id: sessionDB.id },
                    data: { sessionId: sessionId },
                    include: {
                        User: {
                            include: {
                                profile: true,
                                notifications: true,
                                UserSettings: true,
                                Bandage: true,
                                stars: true,
                                AccessRoles: true
                            }
                        }
                    }
                });

                const cookie = generateCookie(sessionId, seconds + Number(process.env.SESSION_TTL));

                return { sessionId: sessionId, cookie: cookie, user: new_tokens.User };
            } else {
                const cookie = generateCookie(session, decoded.exp);
                return { sessionId: sessionDB.sessionId, cookie: cookie, user: sessionDB.User };
            }
        } catch (err) {
            await this.prisma.sessions.delete({ where: { id: sessionDB.id } });
            return null;
        }
    }


    async logout(session: Session) {
        /* user log out */

        await this.prisma.sessions.delete({ where: { sessionId: session.sessionId } });
    }
}

