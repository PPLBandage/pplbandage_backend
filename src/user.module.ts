import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { User, Prisma } from '@prisma/client';
import { sign, verify } from 'jsonwebtoken';
import axios from 'axios';

const discord_url = "https://discord.com/api/v10";
const token_ttl = Number(process.env.SESSION_TTL);

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
    global_name: string,
    avatar_decoration_data: number | null,
    banner_color: string | null,
    clan: string | null,
    mfa_enabled: boolean,
    locale: string,
    premium_type: number
}

interface Session {
    userId: number,
    iat: number,
    exp: number
}

const generateCookie = (session: string, exp: number): string => {
    const date = new Date(exp * 1000);
    return `sessionId=${session}; Path=/; Expires=${date.toUTCString()}; SameSite=Strict`;
}

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) { }

    async user(userWhereUniqueInput: Prisma.UserWhereUniqueInput): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: userWhereUniqueInput,
        });
    }

    async login(code: string): Promise<{ id: number; sessionId: string; userId: number | null; } | null> {
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

        const user_db = await this.prisma.user.upsert({
            where: { 'discordId': ds_user.id },
            create: {
                'discordId': ds_user.id,
                'username': ds_user.username
            },
            update: {}
        })
        const sessionId = sign({ userId: user_db.id }, 'ppl_super_secret', { expiresIn: token_ttl });
        const token_record = await this.prisma.sessions.create({
            data: {
                'sessionId': sessionId,
                'User': {
                    'connect': {
                        'id': user_db.id
                    }
                }
            }
        });
        return token_record
    }

    async validateSession(session: string | undefined): Promise< { sessionId: string; cookie: string; } | null> {
        if (!session) return null;
        const sessionDB = await this.prisma.sessions.findFirst({ where: { sessionId: session } });
        if (!sessionDB) return null;

        try {
            const decoded = verify(session, 'ppl_super_secret') as Session;
            const seconds = Math.round(Date.now() / 1000);
            if (decoded.iat + ((decoded.exp - decoded.iat) / 2) < seconds) {
                const sessionId = sign({ userId: sessionDB.userId }, 'ppl_super_secret', { expiresIn: token_ttl });
                await this.prisma.sessions.update({ where: { id: sessionDB.id }, data: { sessionId: sessionId } });
                const cookie = generateCookie(sessionId, seconds + token_ttl);

                return { sessionId: sessionId, cookie: cookie };
            } else {
                const cookie = generateCookie(session, decoded.exp);
                return { sessionId: session, cookie: cookie };
            }
        } catch (err) {
            return null;
        }
    }

    async getUser(session: string) {
        const sessionDB = await this.prisma.sessions.findFirst({ where: { sessionId: session }, include: { User: true } });
        return { userID: sessionDB?.User.id, discordID: sessionDB?.User.discordId, username: sessionDB?.User.username };
    }
}