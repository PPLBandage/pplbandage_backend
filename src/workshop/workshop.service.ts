import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as sharp from 'sharp';
import { NotificationService } from '../notifications/notifications.service';
import { hasAccess, Session } from 'src/auth/auth.service';
import { RolesEnum } from 'src/interfaces/types';
import { CreateBandageDto } from './dto/createBandage.dto';
import { EditBandageDto } from './dto/editBandage.dto';
import { DiscordNotificationService } from 'src/notifications/discord.service';
import {
    BandageFull,
    generateFlags,
    generateModerationState,
    generateResponse
} from 'src/common/bandage_response';
import responses from 'src/localization/workshop.localization';
import responses_common from 'src/localization/common.localization';
import { LocaleException } from 'src/interceptors/localization.interceptor';

const official_id = 0;

// Relevance settings
const downgrade_factor = 1.5;
const start_boost = 1;
const start_boost_duration = 7;

interface BandageSearch {
    title?: { contains: string };
    description?: { contains: string };
    externalId?: { contains: string };
    User?: { name: { contains: string } };
}

export const sort_keys = ['popular_up', 'date_up', 'name_up', 'relevant_up'];

const constructSort = (
    sort?: string
): Prisma.BandageOrderByWithRelationInput => {
    /* generate sort rule */

    switch (sort) {
        case sort_keys[0]:
            return { stars: { _count: 'desc' } };
        case sort_keys[1]:
            return { creationDate: 'desc' };
        case sort_keys[2]:
            return { title: 'asc' };
        default:
            return {};
    }
};

const componentToHex = (c: number) => {
    /* convert decimal to hex */

    const hex = c.toString(16);
    return hex.length == 1 ? '0' + hex : hex;
};

export const rgbToHex = (r: number, g: number, b: number) => {
    /* convert RGB to HEX */

    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

@Injectable()
export class WorkshopService {
    constructor(
        private prisma: PrismaService,
        private readonly notifications: NotificationService,
        private readonly discordNotifications: DiscordNotificationService
    ) {}

    async getBandagesCount() {
        return await this.prisma.bandage.count();
    }

    async getBandageById(external_id: string) {
        const bandage = await this.prisma.bandage.findFirst({
            where: { externalId: external_id },
            include: {
                User: true,
                categories: true,
                stars: true,
                BandageModeration: true
            }
        });

        if (!bandage) {
            throw new LocaleException(responses.BANDAGE_NOT_FOUND, 404);
        }

        return bandage;
    }

    async getBandageSession(id: string, session?: Session) {
        /* Get and validate bandage from data base */

        const bandage = await this.prisma.bandage.findFirst({
            where: { externalId: id },
            include: {
                User: {
                    include: {
                        UserSettings: true
                    }
                },
                categories: true,
                stars: true,
                BandageModeration: { include: { issuer: true } }
            }
        });
        if (!bandage) {
            throw new LocaleException(responses.BANDAGE_NOT_FOUND, 404);
        }

        const hidden = bandage.BandageModeration?.is_hides ?? false;
        const no_access = session
            ? !hasAccess(session.user, RolesEnum.ManageBandages) &&
              session.user.id !== bandage.User?.id
            : true;
        if ((hidden || bandage.access_level === 0) && no_access) {
            throw new LocaleException(responses.BANDAGE_NOT_FOUND, 404);
        }

        if (
            bandage.User?.UserSettings?.banned &&
            !hasAccess(session?.user, RolesEnum.ManageBandages)
        ) {
            throw new LocaleException(responses.BANDAGE_NOT_FOUND, 404);
        }

        return bandage;
    }

    async getBandages(
        session: Session,
        take: number,
        page: number,
        search?: string,
        filters?: number[],
        sort?: string
    ) {
        /* get workshop list */

        let search_rule: BandageSearch[] | undefined = undefined;
        if (search) {
            search_rule = [
                { title: { contains: search } },
                { description: { contains: search } },
                { externalId: { contains: search } },
                { User: { name: { contains: search } } }
            ];
        }

        const filters_rule =
            filters?.map(el => ({
                categories: { some: { id: el } }
            })) ?? [];

        const admin =
            session &&
            session.user &&
            hasAccess(session.user, RolesEnum.ManageBandages);

        const where: Prisma.BandageWhereInput = {
            User: { UserSettings: { banned: false } },
            access_level: !admin ? 2 : undefined,
            AND: [
                ...filters_rule,
                { OR: search_rule },
                {
                    OR: [
                        { BandageModeration: null },
                        { BandageModeration: { is_hides: false } }
                    ]
                }
            ]
        };

        if (sort === sort_keys[3]) {
            return this.getBandagesRelevance(session, take, page, where, false);
        }

        const data = await this.prisma.bandage.findMany({
            where: where,
            include: {
                User: {
                    include: {
                        UserSettings: true
                    }
                },
                stars: true,
                categories: { orderBy: { order: 'asc' } },
                BandageModeration: { include: { issuer: true } }
            },
            take: Math.min(take, 100),
            skip: take * page,
            orderBy: constructSort(sort)
        });

        const count = await this.prisma.bandage.count({ where: where });
        const result = generateResponse(data, session, false);
        return {
            data: result,
            totalCount: count,
            next_page: result.length ? page + 1 : page
        };
    }

    async getBandagesRelevance(
        session: Session,
        take: number,
        page: number,
        where: Prisma.BandageWhereInput,
        available: boolean
    ) {
        const data = await this.prisma.bandage.findMany({
            where: where,
            include: {
                User: {
                    include: {
                        UserSettings: true
                    }
                },
                stars: true,
                categories: { orderBy: { order: 'asc' } },
                BandageModeration: { include: { issuer: true } }
            }
        });

        const count = await this.prisma.bandage.count({ where: where });

        const getRelevance = (bandage: {
            stars: unknown[];
            creationDate: Date;
            relevance_modifier: number;
            views: number;
        }) => {
            const daysSinceCreation =
                (Date.now() - new Date(bandage.creationDate).getTime()) /
                (1000 * 60 * 60 * 24);

            const stars =
                bandage.stars.length + // Real stars count
                (daysSinceCreation < start_boost_duration ? start_boost : 0) + // Start boost
                bandage.relevance_modifier + // Relevance modifier
                bandage.views / 150; // Views count, represented as stars
            return stars / Math.pow(daysSinceCreation + 1, downgrade_factor);
        };

        const startIndex = page * take;
        const ratedWorks = data
            .sort((a, b) => getRelevance(b) - getRelevance(a))
            .slice(startIndex, startIndex + take);
        const result = generateResponse(ratedWorks, session, available);
        return {
            data: result,
            totalCount: count,
            next_page: result.length ? page + 1 : page
        };
    }

    async setStar(session: Session, set: boolean, id: string) {
        /* set star to bandage by external id */

        const bandage = await this.getBandageById(id);

        const new_data = await this.prisma.bandage.update({
            where: { id: bandage.id },
            data: {
                stars: set
                    ? { connect: { id: session.user.id } }
                    : { disconnect: { id: session.user.id } }
            },
            include: { stars: true }
        });

        return {
            new_count: new_data.stars.length,
            action_set: set
        };
    }

    async clearMetadata(base64?: string) {
        /* Clear bandage's image metadata */
        if (!base64) return '';
        const data = await sharp(Buffer.from(base64, 'base64')).toBuffer({
            resolveWithObject: false
        });
        return data.toString('base64');
    }

    async createBandage(body: CreateBandageDto, session: Session) {
        /* create bandage */

        let categories: { id: number }[] = [];
        if (body.categories !== undefined) {
            const validated_categories = await this.validateCategories(
                body.categories,
                hasAccess(session.user, RolesEnum.SuperAdmin)
            );
            categories = validated_categories.map(el => ({ id: el }));
        }

        const count = await this.prisma.bandage.count({
            where: {
                userId: session.user.id,
                BandageModeration: { type: 'review' }
            }
        }); // get count of under review works

        if (count >= 5) {
            throw new LocaleException(responses.TOO_MANY_BANDAGES, 409);
        }

        const bandage_base64 = await this.clearMetadata(body.base64);
        const bandage_slim_base64 = await this.clearMetadata(body.base64_slim);

        const buff = Buffer.from(bandage_base64, 'base64');
        const data = await sharp(buff)
            .resize(1, 1, { fit: 'inside' })
            .extract({ left: 0, top: 0, width: 1, height: 1 })
            .raw()
            .toBuffer({ resolveWithObject: false });
        const [r, g, b] = data;

        const result = await this.prisma.bandage.create({
            data: {
                externalId: Math.random().toString(36).substring(2, 8),
                title: body.title,
                description: body.description,
                colorable: body.colorable,
                base64: bandage_base64,
                base64_slim: bandage_slim_base64,
                split_type: body.split_type ?? false,
                User: { connect: { id: session.user.id } },
                categories: { connect: categories },
                accent_color: rgbToHex(r, g, b),
                BandageModeration: {
                    create: {
                        type: 'review',
                        message: 'Ваша повязка сейчас проходит модерацию',
                        is_hides: true,
                        userId: session.user.id
                    }
                }
            }
        });

        this.discordNotifications.doBandageNotification(
            'Опубликована новая повязка',
            result as BandageFull,
            session
        );

        await this.notifications.createNotification(session.user.id, {
            content:
                `Повязка <a href="/workshop/${result.externalId}?ref=/me/notifications"><b>${result.title}</b></a> ` +
                `создана и отправлена на проверку!`
        });

        return { external_id: result.externalId };
    }

    async getCategories(for_edit: boolean, session?: Session) {
        /* get list of categories */

        const admin = hasAccess(session?.user, RolesEnum.ManageBandages);
        const categories = await this.prisma.category.findMany({
            where: {
                reachable: for_edit && !admin ? true : undefined,
                visible: true
            },
            orderBy: { order: 'asc' },
            include: { bandages: true }
        });
        return categories.map(category => ({
            id: category.id,
            name: category.name,
            icon: category.icon,
            count: category.bandages.length
        }));
    }

    async getDataForOg(id: string, session?: Session) {
        /* Get bandage data for Open Graph */

        const bandage = await this.getBandageSession(id, session);

        return {
            data: {
                id: bandage.id,
                external_id: bandage.externalId,
                title: bandage.title,
                description: bandage.description,
                average_og_color: bandage.accent_color,
                stars_count: bandage.stars.length,
                author: {
                    id: bandage.User?.id,
                    name: bandage.User?.reserved_name || bandage.User?.name,
                    username: bandage.User?.username,
                    public: bandage.User?.UserSettings?.public_profile
                }
            }
        };
    }

    async getBandage(id: string, session?: Session) {
        /* get bandage by external id */

        const bandage = await this.getBandageSession(id, session);

        let permissions_level = 0;
        if (session) {
            const isBandageOwner = session.user.id === bandage.User.id;
            const canManageBandages = hasAccess(
                session.user,
                RolesEnum.ManageBandages
            );

            if (bandage.archived && !canManageBandages) {
                permissions_level = 0;
            } else if (isBandageOwner || canManageBandages) {
                permissions_level = 2;
            }
        }

        const me_profile =
            session?.user?.UserSettings?.autoload && session?.user?.profile
                ? {
                      uuid: session.user.profile.uuid,
                      nickname: session.user.profile.nickname
                  }
                : undefined;

        const categories = bandage.categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            icon: cat.icon
        }));

        return {
            data: {
                id: bandage.id,
                external_id: bandage.externalId,
                title: bandage.title,
                description: bandage.description,
                base64: bandage.base64,
                base64_slim: bandage.split_type
                    ? bandage.base64_slim
                    : undefined,
                flags: generateFlags(bandage, session),
                creation_date: bandage.creationDate,
                stars_count: bandage.stars.length,
                author: {
                    id: bandage.User.id,
                    name: bandage.User.reserved_name || bandage.User.name,
                    username: bandage.User.username,
                    public: bandage.User.UserSettings?.public_profile
                },
                categories: categories,
                me_profile: me_profile,
                permissions_level: permissions_level,
                access_level: bandage.access_level,
                accent_color: bandage.accent_color,
                moderation: generateModerationState(bandage),
                star_type: bandage.star_type
            }
        };
    }

    async updateBandage(id: string, body: EditBandageDto, session: Session) {
        /* update bandage info */

        const bandage = await this.getBandageById(id);

        const isBandageOwner = bandage.User.id === session.user.id;
        const canManageBandages = hasAccess(
            session.user,
            RolesEnum.ManageBandages
        );

        if (
            (!isBandageOwner && !canManageBandages) ||
            (bandage.archived && !canManageBandages)
        ) {
            throw new LocaleException(responses_common.FORBIDDEN, 403);
        }

        let title = undefined;
        let description = undefined;
        let categories = undefined;
        let access_level = undefined;

        const admin = hasAccess(session.user, RolesEnum.ManageBandages);
        if (body.title !== undefined) title = body.title;
        if (body.description !== undefined) description = body.description;

        // TODO: Rewrite me
        if (body.categories !== undefined) {
            const validated_categories = await this.validateCategories(
                body.categories,
                admin
            );
            const bandage_categories = bandage?.categories.map(el => el.id);
            if (!admin) {
                if (bandage_categories?.includes(official_id))
                    validated_categories.push(official_id);
            }

            categories = validated_categories.map(el => ({ id: el }));
        }

        if (body.access_level !== undefined) {
            const check_al = body.access_level;
            if (!isNaN(check_al) && check_al >= 0 && check_al <= 2)
                access_level = check_al;
        }

        if (!admin && !bandage.BandageModeration?.is_final) {
            await this.changeBandageModeration(
                bandage as BandageFull,
                session,
                'review',
                'Ваша повязка сейчас проходит модерацию',
                false,
                true
            );

            if (
                !bandage.BandageModeration ||
                bandage.BandageModeration?.type === 'denied'
            ) {
                await this.discordNotifications.doBandageNotification(
                    'Запрошена ремодерация повязки',
                    bandage as BandageFull,
                    session
                );
            }
        }

        await this.prisma.bandage.update({
            where: {
                id: bandage.id
            },
            data: {
                title: title,
                description: description,
                colorable: body.colorable,
                categories: {
                    set: categories
                },
                access_level: access_level
            }
        });
    }

    async validateCategories(categories: number[], admin: boolean) {
        /* filter categories that available for user */

        const reachable_categories = await this.prisma.category.findMany({
            where: {
                reachable: admin ? undefined : true
            }
        });

        const reachable_ids = reachable_categories.map(el => el.id);
        return categories.filter(el => reachable_ids.includes(el));
    }

    async deleteBandage(session: Session, externalId: string) {
        /* delete bandage */

        const bandage = await this.getBandageById(externalId);

        const isBandageOwner = session.user.id === bandage.User.id;
        const canManageBandages = hasAccess(
            session.user,
            RolesEnum.ManageBandages
        );

        if (!canManageBandages && !isBandageOwner) {
            throw new LocaleException(responses_common.FORBIDDEN, 403);
        }

        await this.prisma.bandage.delete({ where: { id: bandage.id } });
    }

    async validateBandage(base64: string, heightInit?: number) {
        let height = null;
        let width = null;
        let metadata = null;
        try {
            const bandage_buff = Buffer.from(base64, 'base64');
            const bandage_sharp = sharp(bandage_buff);
            metadata = await bandage_sharp.metadata();
            width = metadata.width as number;
            height = metadata.height as number;
        } catch {
            throw new LocaleException(
                responses.ERROR_WHILE_BANDAGE_PROCESSING,
                500
            );
        }

        if (
            width !== 16 ||
            height < 2 ||
            height > 24 ||
            height % 2 !== 0 ||
            metadata.format !== 'png'
        ) {
            throw new LocaleException(responses.BAD_BANDAGE_SIZE, 400);
        }

        if (!!heightInit && height !== heightInit) {
            throw new LocaleException(responses.BAD_SECOND_BANDAGE_SIZE, 400);
        }

        return { height: height };
    }

    async archiveBandage(session: Session, externalId: string) {
        const bandage = await this.getBandageById(externalId);

        if (
            !hasAccess(session.user, RolesEnum.ManageBandages) &&
            session.user.id !== bandage.User?.id
        ) {
            throw new LocaleException(responses_common.FORBIDDEN, 403);
        }

        await this.prisma.bandage.update({
            where: { externalId: externalId },
            data: { archived: true }
        });
    }

    async addView(external_id: string) {
        const bandage = await this.getBandageById(external_id);

        await this.prisma.bandage.update({
            where: { id: bandage.id },
            data: { views: bandage.views + 1 }
        });
    }

    /** Remove moderation from bandage */
    async approveBandage(bandage: BandageFull) {
        await this.prisma.bandageModeration.delete({
            where: { bandageId: bandage.id }
        });
    }

    /** Change bandage moderation status  */
    async changeBandageModeration(
        bandage: BandageFull,
        session: Session,
        type: string,
        message: string,
        is_final?: boolean,
        is_hides?: boolean
    ) {
        if (type === 'none') {
            this.approveBandage(bandage);
            return;
        }

        await this.prisma.bandageModeration.upsert({
            where: { bandageId: bandage.id },
            create: {
                bandageId: bandage.id,
                type: type,
                message: message,
                userId: session.user.id,
                is_hides: is_hides,
                is_final: is_final
            },
            update: {
                type: type,
                message: message,
                userId: session.user.id,
                is_hides: is_hides,
                is_final: is_final
            }
        });
    }
}
