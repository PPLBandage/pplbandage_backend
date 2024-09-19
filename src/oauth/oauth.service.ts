import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Bandage, Minecraft, User, UserSettings, Notifications, AccessRoles } from '@prisma/client';
import { sign, verify } from 'jsonwebtoken';
import axios from 'axios';
import { RolesEnum } from 'src/interfaces/types';
import { UserService } from 'src/user/user.service';

const discord_url = "https://discord.com/api/v10";
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

const generateCookie = (session: string, exp: number): string => {
    /* generate cookie string */

    const date = new Date(exp * 1000);
    return `sessionId=${session}; Path=/; Expires=${date.toUTCString()}; SameSite=Strict`;
}

export const hasAccess = (user: UserFull | undefined, level: number) => {
    if (!user) return false;
    const user_roles = user.AccessRoles.map((role) => role.level);
    return user_roles.includes(level) || user_roles.includes(RolesEnum.SuperAdmin);
}

const generateSnowflake = (increment: bigint): string => {
    const timestamp = BigInt(Date.now()) - EPOCH;
    const snowflake = (timestamp << 22n) | increment;
    return snowflake.toString();
}


@Injectable()
export class OauthService {
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
        const roles = (await this.getRoles()).map((role) => role.ds_id);
        for (const role of data.roles) {
            if (roles.includes(role)) {
                return true;
            }
        }
        return false;
    }

    async resolveCollisions(username: string) {
        const users = await this.prisma.user.findMany({ where: { username: username } });
        if (users.length <= 1) return;

        await Promise.all(users.map(async user => {
            const current_data = await this.userService.getCurrentData(user.discordId);
            if (!current_data) return;
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    username: current_data.username,
                    name: current_data.global_name || current_data.username
                }
            });
        }));
    }

    async login(code: string, user_agent: string) {
        /* log in by code */

        // ----------------------- Get access token -------------------------------
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

        // ----------------------- Get discord user data --------------------------

        const discord_user = await axios.get(discord_url + "/users/@me", {
            headers: {
                'Authorization': `${data.token_type} ${data.access_token}`
            }, validateStatus: () => true
        });

        if (discord_user.status !== 200) return null;
        const ds_user = discord_user.data as DiscordUser;

        // ----------------------- Check discord server roles ---------------------

        const user_settings = await this.prisma.userSettings.findFirst({ where: { User: { discordId: ds_user.id } } });
        const on_ppl = await this.check_ppl(`${data.token_type} ${data.access_token}`);
        if (!on_ppl && !user_settings?.skip_ppl_check) {
            await this.prisma.sessions.deleteMany({ where: { User: { discordId: ds_user.id } } });
            return { message: "You are not on ppl", statusCode: 403 };
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

        await this.resolveCollisions(user_db.username);

        if (user_db.UserSettings?.banned) {
            await this.prisma.sessions.deleteMany({ where: { userId: user_db.id } });
            return { message: "Unable to login", statusCode: 403 };
        }

        // ----------------------- Create session token ---------------------------

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
