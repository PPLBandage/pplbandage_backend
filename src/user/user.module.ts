import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { hasAccess, Session } from 'src/oauth/oauth.module';
import { UpdateUsersDto } from './dto/updateUser.dto';
import { generate_response } from 'src/common/bandage_response.module';
import { RolesEnum } from 'src/interfaces/types';

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

    async getUser(session: Session) {
        /* get user, associated with session */

        if (session.user.UserSettings?.banned) {
            await this.prisma.sessions.deleteMany({ where: { userId: session.user.id } });
            return { message: "Unable to get user", statusCode: 401 };
        }

        const response_data = await this.getCurrentData(session.user.discordId);
        const updated_user = await this.prisma.user.update({
            where: { id: session.user.id },
            data: {
                name: response_data.global_name || response_data.username
            }
        });

        return {
            statusCode: 200,
            userID: session.user.id,
            discordID: session.user.discordId,
            username: updated_user.username,
            name: updated_user.reserved_name || updated_user.name,
            joined_at: session.user.joined_at,
            avatar: response_data.avatar ? `https://cdn.discordapp.com/avatars/${response_data.id}/${response_data.avatar}` : `/static/favicon.ico`,
            banner_color: response_data.banner_color,
            has_unreaded_notifications: session.user.has_unreaded_notifications,
            permissions: session.user.AccessRoles.map((role) => role.name.toLowerCase()),
            profile_theme: session.user.UserSettings?.profile_theme
        };
    }

    async logout(session: Session) {
        /* user log out */

        await this.prisma.sessions.delete({ where: { sessionId: session.sessionId } });
    }

    async getUserSettings(session: Session) {
        /* get user's settings */

        const minecraft = session.user.profile ? {
            nickname: session.user.profile.default_nick,
            uuid: session.user.profile.uuid,
            last_cached: Number(session.user.profile.expires) - parseInt(process.env.TTL as string),
            head: session.user.profile.data_head,
            valid: session.user.profile.valid,
            autoload: session.user.UserSettings?.autoload
        } : null;

        const current_discord = await this.getCurrentData(session.user.discordId);
        const discord = {
            user_id: session.user.discordId,
            username: session.user.username,
            name: session.user.reserved_name || session.user.name,
            connected_at: session.user.joined_at,
            avatar: current_discord.avatar ?
                `https://cdn.discordapp.com/avatars/${current_discord.id}/${current_discord.avatar}` : null
        }

        return {
            statusCode: 200,
            public_profile: session.user.UserSettings?.public_profile,
            can_be_public: session.user.Bandage.length !== 0,
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

        if (!user) {
            return {
                statusCode: 404,
                message: 'User not found'
            }
        }

        const can_view = hasAccess(session?.user, RolesEnum.UpdateUsers);
        if ((user.UserSettings?.banned || !user.UserSettings?.public_profile) && !can_view) {
            return {
                statusCode: 404,
                message: 'User not found'
            }
        }

        const current_discord = await this.getCurrentData(user.discordId);
        const bandages = await this.prisma.bandage.findMany({
            where: { userId: user.id, access_level: can_view ? undefined : 2, categories: can_view ? undefined : { none: { only_admins: true } } },
            include: { categories: true, stars: true, User: { include: { UserSettings: true } } }
        });

        if (bandages.length === 0 && !can_view) {
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
            name: user.reserved_name || user.name,
            joined_at: user.joined_at,
            avatar: current_discord.avatar ? `https://cdn.discordapp.com/avatars/${current_discord.id}/${current_discord.avatar}` : `/static/favicon.ico`,
            banner_color: current_discord.banner_color,
            works: generate_response(bandages, session, can_view),
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

    async getUsers() {
        const users = await this.prisma.user.findMany({ include: { UserSettings: true, AccessRoles: true } });

        return users.map((user) => ({
            id: user.id,
            username: user.username,
            name: user.reserved_name || user.name,
            joined_at: user.joined_at,
            discord_id: user.discordId,
            banned: user.UserSettings?.banned,
            permissions: user.AccessRoles?.map((role) => role.name.toLowerCase())
        }));
    }

    async updateUser(username: string, data: UpdateUsersDto) {
        const user = await this.prisma.user.findFirst({ where: { username: username } });
        if (!user) {
            return {
                statusCode: 404,
                message: 'User not found'
            }
        }

        await this.prisma.userSettings.update({
            where: { userId: user.id },
            data: { banned: data.banned }
        });

        return {
            statusCode: 200,
            message: 'Updated'
        }
    }
}

