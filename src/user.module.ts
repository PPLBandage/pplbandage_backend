import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { sign, verify } from 'jsonwebtoken';
import axios from 'axios';
import { generate_response } from './app.service';

const discord_url = "https://discord.com/api/v10";
const token_ttl = Number(process.env.SESSION_TTL);
const roles = [
    "1267437920755908689",
    "1142141232685006990",
    "958432771519422476",
    "495989709265436687",
    "589530176501579780",
    "987234058478186506",
    "1123363907692666910"
];  // list of pwgood roles
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

interface pplRes {
    roles: Array<string>,
    user: {
        id: string,
        username: string
    }
}

const generateCookie = (session: string, exp: number): string => {
    /* generate cookie string */

    const date = new Date(exp * 1000);
    return `sessionId=${session}; Path=/; Expires=${date.toUTCString()}; SameSite=Strict`;
}

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) { }

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
        const data = response.data as pplRes;
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

        if (discord_tokens.status != 200) return null;
        const data = discord_tokens.data as DiscordResponse;

        const discord_user = await axios.get(discord_url + "/users/@me", {
            headers: {
                'Authorization': `${data.token_type} ${data.access_token}`
            }, validateStatus: () => true
        });

        if (discord_user.status != 200) return null;
        const ds_user = discord_user.data as DiscordUser;

        const on_ppl = await this.check_ppl(`${data.token_type} ${data.access_token}`);
        if (!on_ppl) {
            await this.prisma.sessions.deleteMany({
                where: {
                    User: {
                        discordId: ds_user.id
                    }
                }
            });
            return { message: "You are not on ppl", statusCode: 403 };
        }

        const user_db = await this.prisma.user.upsert({
            where: { 'discordId': ds_user.id },
            create: {
                'discordId': ds_user.id,
                'username': ds_user.username,
                'name': ds_user.global_name || ds_user.username
            },
            update: {}
        });
        if (user_db.banned) {
            await this.prisma.sessions.deleteMany({ where: { userId: user_db.id } });
            return { message: "Unable to login", statusCode: 403 };
        }
        const sessionId = sign({ userId: user_db.id }, 'ppl_super_secret', { expiresIn: token_ttl });
        const token_record = await this.prisma.sessions.create({
            data: {
                'sessionId': sessionId,
                'User_Agent': user_agent,
                'User': {
                    'connect': {
                        'id': user_db.id
                    }
                }
            }
        });
        return { message: "logged in", sessionId: token_record.sessionId, statusCode: 200 };
    }

    async validateSession(session: string | undefined, user_agent: string): Promise<Session | null> {
        /* validate and update user session */

        if (!session) return null;
        const sessionDB = await this.prisma.sessions.findUnique({ where: { sessionId: session }, include: { User: { include: { profile: true, notifications: true } } } });
        if (!sessionDB) return null;

        if (sessionDB.User_Agent !== user_agent) {
            await this.prisma.sessions.delete({ where: { id: sessionDB.id } });
            return null;
        }

        try {
            const decoded = verify(session, 'ppl_super_secret') as SessionToken;
            const seconds = Math.round(Date.now() / 1000);
            if (decoded.iat + ((decoded.exp - decoded.iat) / 2) < seconds) {
                const sessionId = sign({ userId: sessionDB.userId }, 'ppl_super_secret', { expiresIn: token_ttl });
                const new_tokens = await this.prisma.sessions.update({ where: { id: sessionDB.id }, data: { sessionId: sessionId }, include: { User: { include: { profile: true, notifications: true } } } });
                const cookie = generateCookie(sessionId, seconds + token_ttl);

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

    async getCurrentData(user_id: string) {
        const response = await axios.get(`${discord_url}/users/${user_id}`, {
            headers: {
                Authorization: `Bot ${process.env.BOT_TOKEN}`
            }
        });
        return response.data as DiscordUser;
    }

    async getUser(session: string) {
        /* get user, associated with session */

        const sessionDB = await this.prisma.sessions.findFirst({ where: { sessionId: session }, include: { User: true } });
        if (!sessionDB) {
            return { message: "User not found", statusCode: 401 };
        }

        if (sessionDB.User.banned) {
            await this.prisma.sessions.deleteMany({ where: { userId: sessionDB.User.id } });
            return { message: "Unable to get user", statusCode: 401 };
        }


        const response_data = await this.getCurrentData(sessionDB.User.discordId);

        const updated_user = await this.prisma.user.update({
            where: { id: sessionDB.User.id },
            data: {
                name: response_data.global_name || response_data.username
            }
        });

        let permissions = ['default'];
        if (sessionDB.User.admin) {
            permissions.push('admin');
        }

        return {
            statusCode: 200,
            userID: sessionDB.User.id,
            discordID: sessionDB.User.discordId,
            username: updated_user.username,
            name: updated_user.name,
            joined_at: sessionDB.User.joined_at,
            avatar: response_data.avatar ? `https://cdn.discordapp.com/avatars/${response_data.id}/${response_data.avatar}` : `/static/favicon.ico`,
            banner_color: response_data.banner_color,
            has_unreaded_notifications: sessionDB.User.has_unreaded_notifications,
            permissions: permissions
        };
    }

    async logout(session: Session) {
        /* user log out */

        await this.prisma.sessions.delete({ where: { sessionId: session.sessionId } });
    }

    async getConnections(session: Session) {
        /* get user's associated accounts */

        var minecraft = null;
        var discord = null;

        const data = await this.prisma.minecraft.findFirst({
            where: { userId: session.user.id },
            include: { user: true }
        });

        if (data) {
            minecraft = {
                nickname: data.default_nick,
                uuid: data.uuid,
                last_cached: Number(data.expires) - parseInt(process.env.TTL as string),
                head: data.data_head,
                valid: data.valid,
                autoload: data.user?.autoload
            }
        }

        if (session.user) {
            const current_discord = await this.getCurrentData(session.user.discordId);
            discord = {
                user_id: session.user.discordId,
                username: session.user.username,
                name: session.user.name,
                connected_at: session.user.joined_at,
                avatar: current_discord.avatar ? `https://cdn.discordapp.com/avatars/${current_discord.id}/${current_discord.avatar}` : null
            }
        }

        return {
            statusCode: 200,
            discord: discord,
            minecraft: minecraft
        }
    }

    async getWork(session: Session) {
        /* get list of user's works */

        const result = await this.prisma.bandage.findMany({
            where: {
                userId: session.user.id
            },
            include: {
                stars: true,
                categories: true,
                User: true
            }
        });
        return { statusCode: 200, data: generate_response(result, session) };
    }

    async getStars(session: Session) {
        /* get user's favorite (stars) */

        const result = await this.prisma.bandage.findMany({
            where: {
                stars: {
                    some: {
                        id: session.user.id
                    }
                },
                User: {
                    banned: false
                }
            },
            include: {
                stars: true,
                categories: true,
                User: true
            }
        });
        return { statusCode: 200, data: generate_response(result, session) };
    }

    async getUserByNickname(username: string, session: Session | null) {
        const user = await this.prisma.user.findFirst({ where: { username: username }, include: { Bandage: true } });

        if (!user || user.banned) {
            return {
                statusCode: 404,
                message: 'User not found'
            }
        }

        const current_discord = await this.getCurrentData(user.discordId);
        const bandages = await this.prisma.bandage.findMany({ where: { userId: user.id, access_level: 2 }, include: { categories: true, stars: true, User: true } });

        if (bandages.length === 0) {
            return {
                statusCode: 404,
                message: 'User not found'
            }
        }

        return {
            statusCode: 200,
            userID: user.id,
            discordID: user.discordId,
            username: user.username,
            name: user.name,
            joined_at: user.joined_at,
            avatar: current_discord.avatar ? `https://cdn.discordapp.com/avatars/${current_discord.id}/${current_discord.avatar}` : `/static/favicon.ico`,
            banner_color: current_discord.banner_color,
            works: generate_response(bandages, session),
            is_self: user.id == session?.user?.id
        }
    }
}

