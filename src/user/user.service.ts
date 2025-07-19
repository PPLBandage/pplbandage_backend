import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hasAccess, Session } from 'src/auth/auth.service';
import { UpdateSelfUserDto, UpdateUsersDto } from './dto/body.dto';
import { generateResponse } from 'src/common/bandage_response';
import { RolesEnum } from 'src/interfaces/types';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { LocaleException } from 'src/interceptors/localization.interceptor';

import responses from 'src/localization/users.localization';
import responses_common from 'src/localization/common.localization';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache
    ) {}

    async getUser(session: Session) {
        /* get user, associated with session */

        this.logger.debug('Received /@me request');
        if (session.user.UserSettings?.banned) {
            await this.prisma.sessions.deleteMany({
                where: { userId: session.user.id }
            });
            throw new LocaleException(responses_common.UNAUTHORIZED, 401);
        }

        this.logger.debug('User updated');

        const starred_bandages = await this.prisma.bandage.findMany({
            where: { userId: session.user.id, stars: { some: {} } },
            include: { stars: true }
        });

        this.logger.debug('Starred bandages got');

        const stars_count = starred_bandages.reduce(
            (acc, current_val) => acc + current_val.stars.length,
            0
        );

        this.logger.debug('Processed');
        return {
            userID: session.user.id,
            discordID: session.user.discordId,
            username: session.user.username,
            name: session.user.reserved_name || session.user.name,
            joined_at: session.user.joined_at,
            banner_color: 'var(--main-card-color)', // TODO: Make it changeable
            has_unreaded_notifications: session.user.has_unreaded_notifications,
            roles: session.user.AccessRoles.filter(
                role => role.public_name
            ).map(role => ({
                id: role.id,
                name: role.public_name,
                icon: role.icon
            })),
            profile_theme: session.user.UserSettings?.profile_theme,
            stars_count: stars_count,
            subscribers_count: session.user.subscribers.length
        };
    }

    async logout(session: Session) {
        /* user log out */

        await this.prisma.sessions.delete({
            where: { sessionId: session.sessionId }
        });
    }

    async getUserSettings(session: Session) {
        /* get user's settings */

        const user = await this.prisma.user.findFirstOrThrow({
            where: { id: session.user.id },
            include: {
                profile: true,
                DiscordAuth: true,
                GoogleAuth: true,
                TwitchAuth: true,
                UserSettings: true,
                Bandage: true
            }
        });

        const available_avatars = [];
        if (user.profile) available_avatars.push('minecraft');
        if (user.DiscordAuth && user.DiscordAuth.avatar_id)
            available_avatars.push('discord');
        if (user.GoogleAuth && user.GoogleAuth.avatar_id)
            available_avatars.push('google');
        if (user.TwitchAuth && user.TwitchAuth.avatar_id)
            available_avatars.push('twitch');

        return {
            userID: user.id,
            public_profile: user.UserSettings?.public_profile,
            can_be_public: user.Bandage.length !== 0,
            avatar: {
                current: user.UserSettings?.prefer_avatar || 'discord',
                available: available_avatars
            }
        };
    }

    async getWork(session: Session) {
        /* get list of user's works */

        const result = await this.prisma.bandage.findMany({
            where: {
                userId: session.user.id
            },
            include: {
                stars: true,
                tags: true,
                User: { include: { UserSettings: true } },
                BandageModeration: { include: { issuer: true } }
            }
        });
        return generateResponse(result, session, true);
    }

    async getStars(session: Session) {
        /* get user's favorite (stars) */

        const results = (await this.prisma
            .$queryRaw`SELECT * FROM _UserStars ORDER BY rowid ASC`) as [
            { A: number; B: string }
        ];
        const bandages = results.filter(record => record.B === session.user.id);

        const result = await Promise.all(
            bandages.map(
                async record =>
                    await this.prisma.bandage.findFirst({
                        where: {
                            id: record.A,
                            User: { UserSettings: { banned: false } }
                        },
                        include: {
                            stars: true,
                            tags: true,
                            User: { include: { UserSettings: true } },
                            BandageModeration: { include: { issuer: true } }
                        }
                    })
            )
        );
        return generateResponse(
            result.filter(i => !!i),
            session,
            false
        );
    }

    async _getUserByNickname(username: string, session?: Session) {
        const user = await this.prisma.user.findFirst({
            where: { username: username },
            include: {
                Bandage: true,
                UserSettings: true,
                AccessRoles: true,
                subscribers: true
            }
        });

        if (!user) throw new LocaleException(responses.USER_NOT_FOUND, 404);

        const can_view = hasAccess(session?.user, RolesEnum.UpdateUsers);
        if (
            (user.UserSettings?.banned || !user.UserSettings?.public_profile) &&
            !can_view
        )
            throw new LocaleException(responses.USER_NOT_FOUND, 404);

        return user;
    }

    async getUserByNickname(username: string, session?: Session) {
        const user = await this._getUserByNickname(username, session);

        if (user.id === session?.user?.id) {
            return { is_self: user.id === session?.user?.id };
        }

        const can_view = hasAccess(session?.user, RolesEnum.UpdateUsers);
        const bandages = await this.prisma.bandage.findMany({
            where: {
                userId: user.id,
                access_level: can_view ? undefined : 2
            },
            include: {
                tags: true,
                stars: true,
                User: { include: { UserSettings: true } },
                BandageModeration: { include: { issuer: true } }
            }
        });

        if (bandages.length === 0 && !can_view)
            throw new LocaleException(responses.USER_NOT_FOUND, 404);

        const starred_bandages = await this.prisma.bandage.findMany({
            where: { userId: user.id, stars: { some: {} } },
            include: { stars: true }
        });
        const stars_count = starred_bandages.reduce(
            (acc, current_val) => acc + current_val.stars.length,
            0
        );

        const sessions = await this.prisma.sessions.findMany({
            where: { userId: user.id }
        });
        const last_accessed = sessions.sort(
            (a, b) =>
                new Date(b.last_accessed).getTime() -
                new Date(a.last_accessed).getTime()
        )[0];

        const subscribed = session
            ? !!session.user.subscriptions.find(el => el.id === user.id)
            : undefined;

        return {
            userID: user.id,
            discordID: user.discordId,
            username: user.username,
            name: user.reserved_name || user.name,
            joined_at: user.joined_at,
            banner_color: 'var(--main-card-color)', // TODO: Make it changeable
            works: generateResponse(bandages, session, can_view),
            is_self: user.id == session?.user?.id,
            profile_theme: user.UserSettings?.profile_theme,
            roles: user.AccessRoles.filter(role => role.public_name).map(
                role => ({
                    id: role.id,
                    name: role.public_name,
                    icon: role.icon
                })
            ),
            stars_count: stars_count,
            subscribers_count: user.subscribers.length,
            is_subscribed: subscribed,
            last_accessed: hasAccess(session?.user, RolesEnum.UpdateUsers)
                ? last_accessed?.last_accessed
                : undefined
        };
    }

    async getUserOg(username: string) {
        const user = await this._getUserByNickname(username, undefined);

        const starred_bandages = await this.prisma.bandage.findMany({
            where: { userId: user.id, stars: { some: {} } },
            include: { stars: true }
        });
        const stars_count = starred_bandages.reduce(
            (acc, current_val) => acc + current_val.stars.length,
            0
        );

        return {
            discordID: user.discordId,
            username: user.username,
            name: user.reserved_name || user.name,
            banner_color: 'var(--main-card-color)', // TODO: Make it changeable
            works_count: user.Bandage.length,
            stars_count: stars_count
        };
    }

    async getUsers(page: number, take: number, query?: string) {
        const query_req = !!query
            ? {
                  OR: [
                      { name: { contains: query } },
                      { reserved_name: { contains: query } },
                      { username: { contains: query } },
                      { id: { contains: query } }
                  ]
              }
            : undefined;

        const users = await this.prisma.user.findMany({
            where: query_req,
            include: { UserSettings: true, AccessRoles: true },
            orderBy: { joined_at: 'asc' },
            take: take,
            skip: take * page
        });

        const total_count = await this.prisma.user.count({ where: query_req });
        return {
            data: users.map(user => {
                let flags = Number(user.UserSettings?.banned);
                flags |= Number(user?.UserSettings?.skip_ppl_check) << 1;

                return {
                    id: user.id,
                    username: user.username,
                    name: user.reserved_name || user.name,
                    joined_at: user.joined_at,
                    discord_id: user.discordId,
                    flags: flags,
                    permissions: user.AccessRoles.reduce(
                        (acc, role) => acc | (1 << role.level),
                        0
                    )
                };
            }),
            totalCount: total_count
        };
    }

    async updateUser(session: Session, username: string, data: UpdateUsersDto) {
        const user = await this.prisma.user.findFirst({
            where: { username: username },
            include: { AccessRoles: true }
        });
        if (!user) throw new LocaleException(responses.USER_NOT_FOUND, 404);

        if (
            hasAccess(user, RolesEnum.UpdateUsers) &&
            !hasAccess(session.user, RolesEnum.SuperAdmin)
        )
            throw new LocaleException(responses_common.FORBIDDEN, 403);

        if (session.user.id === user.id && !!data.banned)
            throw new LocaleException(responses.SELFBAN, 400);

        await this.prisma.userSettings.update({
            where: { userId: user.id },
            data: {
                banned: data.banned,
                skip_ppl_check: data.skip_ppl_check
            }
        });
    }

    async updateSelfUser(session: Session, body: UpdateSelfUserDto) {
        /* Update self data */
        /* TODO: Nickname changing */

        if (
            body.minecraft_nick_searchable !== undefined &&
            session.user.profile
        ) {
            await this.prisma.minecraft.update({
                where: { id: session.user.profile.id },
                data: { valid: body.minecraft_nick_searchable }
            });
        }

        await this.prisma.userSettings.update({
            where: { userId: session.user.id },
            data: {
                prefer_avatar: body.preferred_avatar,
                profile_theme: body.profile_theme,
                autoload: body.minecraft_skin_autoload,
                public_profile: body.public_profile
            }
        });
    }

    /** Subscribe to user by nickname */
    async subscribeTo(username: string, session: Session) {
        const user = await this._getUserByNickname(username, session);

        if (user.id === session.user.id)
            throw new LocaleException(responses.BAD_REQUEST, 400);

        await this.prisma.user.update({
            where: { id: session.user.id },
            data: { subscriptions: { connect: { id: user.id } } },
            include: { subscribers: true }
        });

        const count = await this.prisma.user.count({
            where: { subscriptions: { some: { id: user.id } } }
        });
        return { count };
    }

    /** Unsubscribe from user by nickname */
    async unsubscribeFrom(username: string, session: Session) {
        const user = await this._getUserByNickname(username, session);

        if (user.id === session.user.id)
            throw new LocaleException(responses.BAD_REQUEST, 400);

        await this.prisma.user.update({
            where: { id: session.user.id },
            data: { subscriptions: { disconnect: { id: user.id } } },
            include: { subscribers: true }
        });

        const count = await this.prisma.user.count({
            where: { subscriptions: { some: { id: user.id } } }
        });
        return { count };
    }
}

