import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { generate_response } from '../app.service';

const discord_url = "https://discord.com/api/v10";


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


@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) { }

    async getCurrentData(user_id: string): Promise<DiscordUser> {
        const response = await axios.get(`${discord_url}/users/${user_id}`, {
            headers: {
                Authorization: `Bot ${process.env.BOT_TOKEN}`
            }
        });
        return response.data as DiscordUser;
    }

    async getUser(session: string) {
        /* get user, associated with session */

        const sessionDB = await this.prisma.sessions.findFirst({
            where: { sessionId: session },
            include: { User: { include: { UserSettings: true } } }
        });
        if (!sessionDB) {
            return { message: "User not found", statusCode: 401 };
        }

        if (sessionDB.User.UserSettings?.banned) {
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
        if (sessionDB.User.UserSettings?.admin) {
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
            permissions: permissions,
            profile_theme: sessionDB.User.UserSettings?.profile_theme
        };
    }

    async logout(session: Session) {
        /* user log out */

        await this.prisma.sessions.delete({ where: { sessionId: session.sessionId } });
    }

    async getUserSettings(session: Session) {
        /* get user's associated accounts */

        var minecraft = null;
        var discord = null;

        const data = await this.prisma.minecraft.findFirst({
            where: { userId: session.user.id },
            include: { user: { include: { UserSettings: true, Bandage: true } } }
        });

        if (data) {
            minecraft = {
                nickname: data.default_nick,
                uuid: data.uuid,
                last_cached: Number(data.expires) - parseInt(process.env.TTL as string),
                head: data.data_head,
                valid: data.valid,
                autoload: data.user?.UserSettings?.autoload
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
            public_profile: session.user.UserSettings?.public_profile,
            can_be_public: data?.user?.Bandage.length !== 0,
            connections: {
                discord: discord,
                minecraft: minecraft
            }
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
                User: { include: { UserSettings: true } }
            }
        });
        return { statusCode: 200, data: generate_response(result, session) };
    }

    async getStars(session: Session) {
        /* get user's favorite (stars) */

        const result = await this.prisma.bandage.findMany({
            where: {
                stars: {
                    some: { id: session.user.id }
                },
                User: { UserSettings: { banned: false } }
            },
            include: {
                stars: true,
                categories: true,
                User: { include: { UserSettings: true } }
            }
        });
        return { statusCode: 200, data: generate_response(result, session) };
    }

    async getUserByNickname(username: string, session: Session | null) {
        const user = await this.prisma.user.findFirst({
            where: { username: username },
            include: { Bandage: true, UserSettings: true }
        });

        if (!user || user.UserSettings?.banned || !user.UserSettings?.public_profile) {
            return {
                statusCode: 404,
                message: 'User not found'
            }
        }

        const current_discord = await this.getCurrentData(user.discordId);
        const bandages = await this.prisma.bandage.findMany({
            where: { userId: user.id, access_level: 2 },
            include: { categories: true, stars: true, User: { include: { UserSettings: true } } }
        });

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
            is_self: user.id == session?.user?.id,
            profile_theme: user.UserSettings?.profile_theme
        }
    }

    async setProfileTheme(session: Session, theme: number) {
        await this.prisma.userSettings.update({ where: { userId: session.user.id }, data: { profile_theme: theme } });
    }

    async changeAutoload(session: Session, state: boolean) {
        /* switch skin autoload in editor */

        const result = await this.prisma.userSettings.update({
            where: { userId: session.user.id }, data: { autoload: state }
        })
        return { statusCode: 200, new_data: result.autoload };
    }

    async setPublic(session: Session, state: boolean) {
        /* change profile visibility */

        const result = await this.prisma.userSettings.update({
            where: { userId: session.user.id }, data: { public_profile: state }
        })
        return { statusCode: 200, new_data: result.public_profile };
    }
}

