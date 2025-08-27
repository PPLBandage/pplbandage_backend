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

// Relevance settings
const downgrade_factor = 1.5;
const start_boost = 1; // In stars
const start_boost_duration = 7; // In days

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
        return await this.prisma.bandage.count({
            where: {
                OR: [
                    { BandageModeration: null },
                    { BandageModeration: { is_hides: false } }
                ]
            }
        });
    }

    async getBandageById(external_id: string) {
        const bandage = await this.prisma.bandage.findFirst({
            where: { externalId: external_id },
            include: {
                User: true,
                tags: true,
                stars: true,
                BandageModeration: true
            }
        });

        if (!bandage) {
            throw new LocaleException(responses.BANDAGE_NOT_FOUND, 404);
        }

        return bandage;
    }

    async getBandageSession(
        id: string,
        session?: Session,
        skip_session_check?: boolean
    ) {
        /* Get and validate bandage from data base */

        const bandage = await this.prisma.bandage.findFirst({
            where: { externalId: id },
            include: {
                User: {
                    include: {
                        UserSettings: true
                    }
                },
                tags: true,
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
        if (
            (hidden || bandage.access_level === 0) &&
            no_access &&
            !skip_session_check
        ) {
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
        sort?: string
    ) {
        /* get workshop list */

        let search_rule = undefined;
        if (search) {
            search_rule = [
                { title: { contains: search } },
                { description: { contains: search } },
                { externalId: { contains: search } },
                { User: { name: { contains: search } } },
                {
                    tags: {
                        some: {
                            name_search: {
                                contains: search.toLocaleLowerCase()
                            }
                        }
                    }
                }
            ];
        }

        const admin =
            session &&
            session.user &&
            hasAccess(session.user, RolesEnum.ManageBandages);

        const where: Prisma.BandageWhereInput = {
            User: { UserSettings: { banned: false } },
            access_level: !admin ? 2 : undefined,
            AND: [
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
                tags: true,
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
                tags: true,
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

        const { height } = await this.validateBandage(body.base64);

        if (body.split_type) {
            if (!body.base64_slim)
                throw new LocaleException(responses_common.INVALID_BODY, 400);

            await this.validateBandage(body.base64_slim, height as number);
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
                accent_color: rgbToHex(r, g, b),
                BandageModeration: {
                    create: {
                        type: 'review',
                        message: 'Ваша повязка сейчас проходит модерацию',
                        is_hides: true,
                        is_first: true,
                        userId: session.user.id
                    }
                }
            },
            include: { User: true, tags: true }
        });

        // Connect or create requested tags to created bandage
        await this.updateTagsForBandage(
            body.tags ?? [],
            result as BandageFull,
            false
        );

        await this.discordNotifications.doBandageNotification(
            'Опубликована новая повязка',
            result as BandageFull,
            body.tags ?? []
        );

        await this.notifications.createBandageCreationNotification(
            result as BandageFull
        );

        return { external_id: result.externalId };
    }

    /** Updates / creates list of tags for bandage */
    async updateTagsForBandage(
        tags: string[],
        bandage: BandageFull,
        verified: boolean
    ) {
        const loweredTags = tags.map(t =>
            t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '')
        );

        const existingTags = await this.prisma.tags.findMany({
            where: { name_search: { in: loweredTags } }
        });

        const existingByName = new Map(
            existingTags.map(tag => [tag.name_search, tag.id])
        );

        const tagIds: number[] = [];
        for (const tag of tags) {
            const searchName = tag.toLowerCase();
            if (existingByName.has(searchName)) {
                tagIds.push(existingByName.get(searchName)!);
            } else {
                const newTag = await this.prisma.tags.create({
                    data: {
                        name: tag,
                        name_search: searchName,
                        verified: verified
                    }
                });
                tagIds.push(newTag.id);
            }
        }

        await this.prisma.bandage.update({
            where: { id: bandage.id },
            data: {
                tags: {
                    set: tagIds.map(id => ({ id }))
                }
            }
        });

        await this.prisma.tags.deleteMany({
            where: { bandages: { none: {} } }
        });
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
                    id: bandage.User.id,
                    name: bandage.User.name,
                    username: bandage.User.username,
                    public: bandage.User.UserSettings!.public_profile
                }
            }
        };
    }

    async getOGImage(id: string, w: number, session?: Session, token?: string) {
        const requested_width = w ?? 512;

        const data = await this.getBandage(
            id,
            session,
            token === process.env.WORKSHOP_TOKEN
        );

        const bandage_buff = Buffer.from(data.data.base64, 'base64');
        const metadata = await sharp(bandage_buff).metadata();
        const original_width = metadata.width as number;
        const original_height = metadata.height as number;

        const factor = requested_width / original_width;
        const width = original_width * factor;
        const height = original_height * factor;

        const bandage = sharp({
            create: {
                width: width,
                height: height / 2,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        }).png();

        const firstLayer = await sharp(bandage_buff)
            .extract({
                left: 0,
                top: original_height / 2,
                width: original_width,
                height: original_height / 2
            })
            .resize(width, height / 2, { kernel: sharp.kernel.nearest })
            .modulate({ lightness: -5 })
            .png()
            .toBuffer();

        const secondLayer = await sharp(bandage_buff)
            .extract({
                left: 0,
                top: 0,
                width: original_width,
                height: original_height / 2
            })
            .resize(width, height / 2, { kernel: sharp.kernel.nearest })
            .png()
            .toBuffer();

        bandage.composite([
            { input: firstLayer, top: 0, left: 0, blend: 'over' },
            { input: secondLayer, top: 0, left: 0, blend: 'over' }
        ]);

        return await bandage.toBuffer();
    }

    async getBandage(
        id: string,
        session?: Session,
        skip_session_check?: boolean
    ) {
        /* get bandage by external id */

        const bandage = await this.getBandageSession(
            id,
            session,
            skip_session_check
        );

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
                    name: bandage.User.name,
                    username: bandage.User.username,
                    public: bandage.User.UserSettings!.public_profile
                },
                tags: bandage.tags.map(tag => tag.name),
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
        let access_level = undefined;

        const admin = hasAccess(session.user, RolesEnum.ManageBandages);
        if (body.title !== undefined) title = body.title;
        if (body.description !== undefined) description = body.description;

        if (body.access_level !== undefined) {
            const check_al = body.access_level;
            if (!isNaN(check_al) && check_al >= 0 && check_al <= 2)
                access_level = check_al;
        }

        if (body.tags) {
            // Connect or create tags for bandage
            await this.updateTagsForBandage(
                body.tags,
                bandage as BandageFull,
                admin
            );
        }

        const result = await this.prisma.bandage.update({
            where: {
                id: bandage.id
            },
            data: {
                title: title,
                description: description,
                colorable: body.colorable,
                access_level: access_level
            },
            include: { User: true, tags: true }
        });

        // Do some notifications
        if (!admin && !bandage.BandageModeration?.is_final) {
            await this.changeBandageModeration(
                result as BandageFull,
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
                    result as BandageFull
                );
            }
        }
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
            width = metadata.width;
            height = metadata.height;
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

        const isBandageOwner = session.user.id === bandage.User.id;
        const canManageBandages = hasAccess(
            session.user,
            RolesEnum.ManageBandages
        );
        if (!isBandageOwner && !canManageBandages) {
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
        try {
            await this.prisma.bandageModeration.delete({
                where: { bandageId: bandage.id }
            });
        } catch {
            console.debug('Cannot approve approved bandage');
        }
    }

    /** Change bandage moderation status */
    async changeBandageModeration(
        bandage: BandageFull,
        session: Session,
        type: string,
        message: string,
        is_final?: boolean,
        is_hides?: boolean
    ) {
        const last_type = bandage.BandageModeration?.type ?? '';
        if (last_type !== 'denied' && type === 'denied') {
            await this.notifications.createDenyNotification(bandage);
        }

        if (['review', 'denied'].includes(last_type) && type === 'none') {
            // Approve this bandage's tags
            await this.prisma.tags.updateMany({
                where: { bandages: { some: { id: bandage.id } } },
                data: { verified: true }
            });

            await this.notifications.createApproveNotification(bandage);
        }

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

    /** Get under moderation bandages */
    async getModerationWorks(session: Session) {
        const bandages = await this.prisma.bandage.findMany({
            where: { BandageModeration: { is_hides: true } },
            orderBy: { creationDate: 'asc' },
            include: {
                User: {
                    include: {
                        UserSettings: true
                    }
                },
                stars: true,
                tags: true,
                BandageModeration: { include: { issuer: true } }
            }
        });

        return generateResponse(
            bandages.sort((a, b) => {
                if (a.BandageModeration?.type === 'review') return -1;
                if (b.BandageModeration?.type === 'denied') return 1;
                return 0;
            }),
            session,
            true
        );
    }

    /** Get list of verified tags */
    async suggestTag(q?: string) {
        const tags = await this.prisma.tags.findMany({
            where: {
                name_search: { contains: q?.toLowerCase() },
                verified: true
            },
            orderBy: { bandages: { _count: 'desc' } },
            take: 20
        });

        return tags.map(tag => tag.name);
    }
}
