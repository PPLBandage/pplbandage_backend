import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { generateSnowflake, hasAccess, Session } from 'src/auth/auth.service';
import { UpdateSelfUserDto, UpdateUsersDto } from './dto/updateUser.dto';
import { generateResponse } from 'src/common/bandage_response';
import { RolesEnum } from 'src/interfaces/types';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

const discord_url = process.env.DISCORD_URL + "/api/v10";


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
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache
    ) { }

    async resolveCollisions(username: string) {
        /* Resolve usernames collisions in database */

        const users = await this.prisma.user.findMany({ where: { username: username } });
        if (users.length <= 1) return;

        await Promise.all(users.map(async user => {
            const current_data = await this.getCurrentData(user.discordId);
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

    async getCurrentData(user_id: string): Promise<DiscordUser | null> {
        const cache = await this.cacheManager.get<string>(`discord:${user_id}`);
        if (cache) return JSON.parse(cache) as DiscordUser;

        const response = await axios.get(`${discord_url}/users/${user_id}`, {
            headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
            validateStatus: () => true
        });

        if (response.status !== 200) {
            return null;
        }
        const data = response.data as DiscordUser;

        await this.cacheManager.set(`avatar_hash:${user_id}`, data.avatar ?? 'none', 1000 * 60 * 10);
        await this.cacheManager.set(`discord:${user_id}`, JSON.stringify(response.data), 1000 * 60 * 60);
        return data;
    }

    async getAvatar(user_id: string) {
        const user = await this.prisma.user.findFirst({ where: { discordId: user_id } });
        if (!user) return null;

        const avatar_cache = await this.cacheManager.get<string>(`avatar:${user_id}`);
        if (avatar_cache) return avatar_cache;

        let hash = await this.cacheManager.get<string>(`avatar_hash:${user_id}`);
        if (!hash) {
            hash = (await this.getCurrentData(user_id))?.avatar ?? 'none';
        }

        if (hash === 'none') return null;

        const avatar_response = await axios.get(`${process.env.DISCORD_AVATAR}/${user_id}/${hash}.png?size=512`, { responseType: 'arraybuffer' });
        const avatarB64 = Buffer.from(avatar_response.data).toString('base64');
        await this.cacheManager.set(`avatar:${user_id}`, avatarB64, 1000 * 60 * 60 * 24);
        return avatarB64;
    }

    async getUser(session: Session) {
        /* get user, associated with session */

        if (session.user.UserSettings?.banned) {
            await this.prisma.sessions.deleteMany({ where: { userId: session.user.id } });
            return {
                statusCode: 401,
                message: "Unable to get user",
                message_ru: 'Не удалось получить профиль пользователя'
            };
        }

        const response_data = await this.getCurrentData(session.user.discordId);

        if (!response_data) {
            return {
                statusCode: 500,
                message: 'Unable to get user data',
                message_ru: 'Не удалось получить актуальную информацию о профиле пользователя'
            }
        }
        const updated_user = await this.prisma.user.update({
            where: { id: session.user.id },
            data: {
                name: response_data.global_name || response_data.username
            }
        });

        const starred_bandages = await this.prisma.bandage.findMany({
            where: { userId: session.user.id, stars: { some: {} } },
            include: { stars: true }
        });
        const stars_count = starred_bandages.reduce((acc, current_val) => acc + current_val.stars.length, 0);

        return {
            statusCode: 200,
            userID: session.user.id,
            discordID: session.user.discordId,
            username: updated_user.username,
            name: updated_user.reserved_name || updated_user.name,
            joined_at: session.user.joined_at,
            avatar: response_data.avatar ?
                `${process.env.DOMAIN}/api/v1/avatars/${session.user.discordId}` :
                `${process.env.DOMAIN}/icon.png`,
            banner_color: response_data.banner_color,
            has_unreaded_notifications: session.user.has_unreaded_notifications,
            permissions: session.user.AccessRoles.map(role => role.name.toLowerCase()),
            roles: session.user.AccessRoles
                .filter(role => role.public_name)
                .map(role => ({ id: role.id, name: role.public_name, icon: role.icon })),
            profile_theme: session.user.UserSettings?.profile_theme,
            stars_count: stars_count
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

        if (!current_discord) {
            return {
                statusCode: 500,
                message: 'Unable to get user data',
                message_ru: 'Не удалось получить актуальную информацию о профиле пользователя'
            }
        }

        const discord = {
            user_id: session.user.discordId,
            username: session.user.username,
            name: session.user.reserved_name || session.user.name,
            connected_at: session.user.joined_at,
            avatar: current_discord.avatar ?
                `${process.env.DOMAIN}/api/v1/avatars/${session.user.discordId}` :
                `${process.env.DOMAIN}/icon.png`
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
        return { statusCode: 200, data: generateResponse(result, session) };
    }

    async getStars(session: Session) {
        /* get user's favorite (stars) */

        const results = await this.prisma.$queryRaw`SELECT * FROM _UserStars ORDER BY rowid ASC` as [{ A: number, B: string }];
        const bandages = results.filter(record => record.B === session.user.id);

        const result = await Promise.all(bandages.map(async record => {
            return await this.prisma.bandage.findFirst({
                where: {
                    id: record.A,
                    User: { UserSettings: { banned: false } }
                },
                include: {
                    stars: true,
                    categories: true,
                    User: { include: { UserSettings: true } }
                }
            })
        }));
        return { statusCode: 200, data: generateResponse(result.filter(i => !!i), session) };
    }

    async _getUserByNickname(username: string, session: Session | null) {
        const user = await this.prisma.user.findFirst({
            where: { username: username },
            include: { Bandage: true, UserSettings: true, AccessRoles: true }
        });

        if (!user) {
            return null;
        }

        const can_view = hasAccess(session?.user, RolesEnum.UpdateUsers);
        if ((user.UserSettings?.banned || !user.UserSettings?.public_profile) && !can_view) {
            return null;
        }
        return user;
    }

    async getUserByNickname(username: string, session: Session | null) {
        const user = await this._getUserByNickname(username, session);

        if (!user) {
            return {
                statusCode: 404,
                message: 'User not found',
                message_ru: 'Пользователь не найден'
            }
        }

        if (user.id === session?.user?.id) {
            return {
                statusCode: 200,
                is_self: user.id === session?.user?.id
            }
        }

        const can_view = hasAccess(session?.user, RolesEnum.UpdateUsers);
        const current_discord = await this.getCurrentData(user.discordId);

        if (!current_discord) {
            return {
                statusCode: 500,
                message: 'Unable to get user data',
                message_ru: 'Не удалось получить актуальную информацию о профиле пользователя'
            }
        }

        const updated_user = await this.prisma.user.update({
            where: { id: user.id },
            data: { name: current_discord.global_name || current_discord.username }
        });

        const bandages = await this.prisma.bandage.findMany({
            where: {
                userId: user.id,
                access_level: can_view ? undefined : 2,
                categories: can_view ? undefined : { none: { only_admins: true } }
            },
            include: { categories: true, stars: true, User: { include: { UserSettings: true } } }
        });

        if (bandages.length === 0 && !can_view) {
            return {
                statusCode: 404,
                message: 'User not found',
                message_ru: 'Пользователь не найден'
            }
        }

        const starred_bandages = await this.prisma.bandage.findMany({
            where: { userId: user.id, stars: { some: {} } },
            include: { stars: true }
        });
        const stars_count = starred_bandages.reduce((acc, current_val) => acc + current_val.stars.length, 0);

        const sessions = await this.prisma.sessions.findMany({ where: { userId: user.id } });
        const last_accessed = sessions.sort((a, b) => new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime())[0];

        return {
            statusCode: 200,
            userID: user.id,
            discordID: user.discordId,
            username: updated_user.username,
            name: updated_user.reserved_name || updated_user.name,
            joined_at: user.joined_at,
            avatar: current_discord.avatar ?
                `${process.env.DOMAIN}/api/v1/avatars/${current_discord.id}` :
                `${process.env.DOMAIN}/icon.png`,
            banner_color: current_discord.banner_color,
            works: generateResponse(bandages, session, can_view),
            is_self: user.id == session?.user?.id,
            profile_theme: user.UserSettings?.profile_theme,
            roles: user.AccessRoles
                .filter(role => role.public_name)
                .map(role => ({ id: role.id, name: role.public_name, icon: role.icon })),
            stars_count: stars_count,
            last_accessed: hasAccess(session?.user, RolesEnum.UpdateUsers) ? last_accessed?.last_accessed : undefined
        }
    }

    async getUserOg(username: string) {
        const user = await this._getUserByNickname(username, null);
        if (!user) {
            return {
                statusCode: 404,
                message: 'User not found',
                message_ru: 'Пользователь не найден'
            }
        }
        const current_discord = await this.getCurrentData(user.discordId);

        if (!current_discord) {
            return {
                statusCode: 500,
                message: 'Unable to get user data',
                message_ru: 'Не удалось получить актуальную информацию о профиле пользователя'
            }
        }

        return {
            statusCode: 200,
            discordID: user.discordId,
            username: user.username,
            name: user.reserved_name || user.name,
            avatar: current_discord.avatar ?
                `${process.env.DOMAIN}/api/v1/avatars/${current_discord.id}` :
                `${process.env.DOMAIN}/icon.png`,
            banner_color: current_discord.banner_color,
            works_count: user.Bandage.length,
        }
    }

    async getUsers(query?: string) {
        const users = await this.prisma.user.findMany({
            where: !!query ? {
                OR: [
                    { name: { contains: query } },
                    { reserved_name: { contains: query } },
                    { username: { contains: query } },
                    { id: { contains: query } }
                ]
            } : undefined,
            include: { UserSettings: true, AccessRoles: true }
        });

        return users.map(user => ({
            id: user.id,
            username: user.username,
            name: user.reserved_name || user.name,
            joined_at: user.joined_at,
            discord_id: user.discordId,
            banned: user.UserSettings?.banned,
            permissions: user.AccessRoles?.map(role => role.name.toLowerCase()),
            skip_ppl_check: user.UserSettings?.skip_ppl_check
        }));
    }

    async updateUser(session: Session, username: string, data: UpdateUsersDto) {
        const user = await this.prisma.user.findFirst({ where: { username: username }, include: { AccessRoles: true } });
        if (!user) {
            return {
                statusCode: 404,
                message: 'User not found',
                message_ru: 'Пользователь не найден'
            }
        }

        if (hasAccess(user, RolesEnum.UpdateUsers) && !hasAccess(session.user, RolesEnum.SuperAdmin)) {
            return {
                statusCode: 403,
                message: 'Forbidden',
                message_ru: 'Недостаточно прав для совершения этого действия'
            }
        }

        if (session.user.id === user.id && !!data.banned) {
            return {
                statusCode: 400,
                message: 'You cannot ban yourself',
                message_ru: 'Вы не можете забанить себя'
            }
        }

        await this.prisma.userSettings.update({
            where: { userId: user.id },
            data: {
                banned: data.banned,
                skip_ppl_check: data.skip_ppl_check
            }
        });

        return {
            statusCode: 200,
            message: 'Updated',
            message_ru: 'Обновлён'
        }
    }

    async updateSelfUser(session: Session, body: UpdateSelfUserDto) {
        /* Update self data */
        /* TODO: Nickname changing */

        if (
            body.theme !== undefined ||
            body.skin_autoload !== undefined ||
            body.public !== undefined
        ) {
            await this.prisma.userSettings.update({
                where: { userId: session.user.id },
                data: {
                    profile_theme: body.theme,
                    autoload: body.skin_autoload,
                    public_profile: body.public
                }
            });
        }

        if (body.nick_search !== undefined) {
            if (!session.user.profile) {
                return {
                    statusCode: 400,
                    message: 'Minecraft profile didn\'t connected',
                    message_ru: 'К вашему профилю не подключена учетная запись Minecraft'
                }
            }
            await this.prisma.minecraft.update({
                where: { id: session.user.profile.id },
                data: { valid: body.nick_search }
            });
        }

        return {
            statusCode: 200,
            message: 'Patched',
            message_ru: 'Обновлен'
        }
    }

    async forceRegister(discord_id: string) {
        const user_data = await this.getCurrentData(discord_id);
        if (!user_data) {
            return {
                statusCode: 404,
                message: 'User not found',
                message_ru: 'Не удается найти профиль пользователя'
            }
        }

        const existing_user = await this.prisma.user.findFirst({ where: { discordId: discord_id } });
        if (existing_user) {
            return {
                statusCode: 409,
                message: 'User already registered',
                message_ru: 'Пользователь уже зарегистрирован'
            }
        }

        const users_count = await this.prisma.user.count();
        const user_db = await this.prisma.user.upsert({
            where: { discordId: user_data.id },
            create: {
                id: generateSnowflake(BigInt(users_count)),
                discordId: user_data.id,
                username: user_data.username,
                name: user_data.global_name || user_data.username,
                UserSettings: { create: { skip_ppl_check: true } },
                AccessRoles: {
                    connect: { level: 0 }
                }
            },
            update: {},
            include: { UserSettings: true }
        });

        await this.resolveCollisions(user_db.username);

        return {
            statusCode: 201,
            message: 'User created',
            message_ru: 'Пользователь зарегистрирован'
        }
    }
}

