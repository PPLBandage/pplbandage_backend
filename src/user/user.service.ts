import { HttpException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hasAccess } from 'src/auth/auth.service';
import { Session } from 'src/interfaces/interfaces';
import { UpdateSelfUserDto, UpdateUsersDto } from './dto/body.dto';
import { generateResponse } from 'src/common/bandage_response';
import { RolesEnum } from 'src/interfaces/types';
import { LocaleException } from 'src/interceptors/localization.interceptor';

import responses from 'src/localization/users.localization';
import responses_common from 'src/localization/common.localization';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);
    constructor(private prisma: PrismaService) {}

    async getUser(session: Session) {
        /* get user, associated with session */

        if (session.user.UserSettings!.banned) {
            await this.prisma.sessions.deleteMany({
                where: { userId: session.user.id }
            });
            throw new LocaleException(responses_common.UNAUTHORIZED, 401);
        }

        const starred_bandages = await this.prisma.bandage.findMany({
            where: { userId: session.user.id },
            include: { stars: true }
        });

        const stars_count = starred_bandages.reduce(
            (acc, current_val) => acc + current_val.stars.length,
            0
        );

        return {
            userID: session.user.id,
            username: session.user.username,
            name: session.user.name,
            joined_at: session.user.joined_at,
            banner_color: session.user.UserSettings!.theme_color,
            profile_theme: session.user.UserSettings!.profile_theme,
            has_unreaded_notifications: session.user.has_unreaded_notifications,
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
                TelegramAuth: true,
                TwitchAuth: true,
                UserSettings: true,
                Bandage: true
            }
        });

        const available_avatars = [];
        if (user.DiscordAuth && user.DiscordAuth.avatar_id)
            available_avatars.push('discord');
        if (user.GoogleAuth && user.GoogleAuth.avatar_id)
            available_avatars.push('google');
        if (user.TwitchAuth && user.TwitchAuth.avatar_id)
            available_avatars.push('twitch');
        if (user.TelegramAuth && user.TelegramAuth.avatar_id)
            available_avatars.push('telegram');
        if (user.profile) available_avatars.push('minecraft');

        return {
            userID: user.id,
            public_profile: user.UserSettings!.public_profile,
            can_be_public: user.Bandage.length !== 0,
            avatar: {
                current:
                    user.UserSettings!.prefer_avatar || available_avatars.at(0),
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

    async getStars(session: Session, page: number, take: number) {
        /* get user's favorite (stars) with pagination */

        const results = (await this.prisma
            .$queryRaw`SELECT * FROM _UserStars ORDER BY rowid ASC`) as [
            { A: number; B: string }
        ];
        const bandages = results
            .filter(record => record.B === session.user.id)
            .reverse();
        const paginatedBandages = bandages.slice(
            page * take,
            (page + 1) * take
        );

        const result = await Promise.all(
            paginatedBandages.map(
                async record =>
                    (await this.prisma.bandage.findFirst({
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
                    }))!
            )
        );
        return {
            data: generateResponse(result, session, false),
            totalCount: bandages.length
        };
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
            (user.UserSettings!.banned || !user.UserSettings!.public_profile) &&
            !can_view
        )
            throw new LocaleException(responses.USER_NOT_FOUND, 404);

        return user;
    }

    async getUserByNickname(username: string, session?: Session) {
        const user = await this._getUserByNickname(username, session);

        if (session && user.id === session.user.id) {
            return { is_self: true };
        }

        const can_view = hasAccess(session?.user, RolesEnum.UpdateUsers);
        const bandages = await this.prisma.bandage.findMany({
            where: {
                userId: user.id,
                access_level: can_view ? undefined : 2,
                OR: can_view
                    ? undefined
                    : [
                          { BandageModeration: null },
                          { BandageModeration: { is_hides: false } }
                      ]
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
            where: { userId: user.id },
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
            username: user.username,
            name: user.name,
            joined_at: user.joined_at,
            profile_theme: user.UserSettings!.profile_theme,
            banner_color: user.UserSettings!.theme_color,
            works: generateResponse(bandages, session, can_view),
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
            userID: user.id,
            username: user.username,
            name: user.name,
            banner_color: user.UserSettings?.theme_color,
            works_count: user.Bandage.length,
            stars_count: stars_count
        };
    }

    async getUsers(page: number, take: number, query?: string) {
        const query_req = !!query
            ? {
                  OR: [
                      { name: { contains: query } },
                      { username: { contains: query } },
                      { id: { contains: query } }
                  ]
              }
            : undefined;

        const users = await this.prisma.user.findMany({
            where: query_req,
            include: {
                UserSettings: true,
                AccessRoles: true,
                DiscordAuth: true,
                GoogleAuth: true,
                profile: true,
                TwitchAuth: true,
                TelegramAuth: true
            },
            orderBy: { joined_at: 'asc' },
            take: take,
            skip: take * page
        });

        const total_count = await this.prisma.user.count({ where: query_req });
        return {
            data: users.map(user => {
                let flags = Number(user.UserSettings?.banned);
                // flags |= Number(user?.UserSettings?.skip_ppl_check) << 1;

                // Connected auth providers
                flags |= Number(!!user.DiscordAuth) << 2;
                flags |= Number(!!user.GoogleAuth) << 3;
                flags |= Number(!!user.TwitchAuth) << 4;
                flags |= Number(!!user.profile) << 5;
                flags |= Number(!!user.TelegramAuth) << 6;

                return {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    joined_at: user.joined_at,
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

    async updateUserAdmin(
        session: Session,
        username: string,
        data: UpdateUsersDto
    ) {
        const user = await this._getUserByNickname(username, session);

        if (
            hasAccess(user, RolesEnum.UpdateUsers) &&
            !hasAccess(session.user, RolesEnum.SuperAdmin)
        )
            throw new LocaleException(responses_common.FORBIDDEN, 403);

        if (session.user.id === user.id && !!data.banned)
            throw new LocaleException(responses.SELFBAN, 400);

        this.logger.log(
            `Admin *${session.user.username}* updated user *${username}*:\n` +
                `   *banned*: ${data.banned}`,
            UserService.name,
            true
        );
        await this.prisma.userSettings.update({
            where: { userId: user.id },
            data: {
                banned: data.banned
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
                public_profile: body.public_profile,
                theme_color: body.theme_color,
                minecraft_main_page_skin: body.minecraft_main_page_skin
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
            data: { subscriptions: { connect: { id: user.id } } }
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
            data: { subscriptions: { disconnect: { id: user.id } } }
        });

        const count = await this.prisma.user.count({
            where: { subscriptions: { some: { id: user.id } } }
        });
        return { count };
    }

    async deleteMe(session: Session) {
        if (
            session.user.AccessRoles.some(i => i.level === RolesEnum.SuperAdmin)
        )
            throw new HttpException('Admin cannot delete self account', 403);

        const user_id = session.user.id;
        await this.prisma.$transaction(async tx => {
            await tx.user.update({
                where: { id: user_id },
                data: {
                    subscriptions: { set: [] },
                    subscribers: { set: [] },
                    stars: { set: [] },
                    notifications: { set: [] },
                    profile: { disconnect: {} },
                    AccessRoles: { set: [] }
                }
            });

            await tx.user.delete({ where: { id: user_id } });
        });

        this.logger.log(
            `User deleted: ${session.user.name}`,
            UserService.name,
            true
        );
    }
}
