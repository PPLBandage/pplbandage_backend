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
import { generate_response } from 'src/common/bandage_response';

const moderation_id = [4, 13];  // на проверке, отклонено
const official_id = 0;


interface BandageSearch {
    title?: { contains: string },
    description?: { contains: string },
    externalId?: { contains: string; },
    User?: { name: { contains: string } }
}

export const sort_keys = ['popular_up', 'date_up', 'name_up'];

const constructSort = (sort?: string): Prisma.BandageOrderByWithRelationInput => {
    /* generate sort rule */

    switch (sort) {
        case sort_keys[0]:
            return { stars: { _count: 'desc' } };
        case sort_keys[1]:
            return { creationDate: 'desc' };
        case sort_keys[2]:
            return { title: 'asc' }
        default:
            return {};
    }
}

const componentToHex = (c: number) => {
    /* convert decimal to hex */

    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

const rgbToHex = (r: number, g: number, b: number) => {
    /* convert RGB to HEX */

    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}


@Injectable()
export class BandageService {
    constructor(private prisma: PrismaService,
        private notifications: NotificationService,
        private discordNotifications: DiscordNotificationService
    ) { }

    async getBandagesCount() {
        return await this.prisma.bandage.count();
    }

    async getBandages(session: Session,
        take: number,
        page: number,
        search?: string,
        filters?: number[],
        sort?: string) {

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

        const filters_rule = filters?.map(el => ({ categories: { some: { id: el } } }));

        let available = false;
        let admin = false;
        if (session && session.user && hasAccess(session.user, RolesEnum.ManageBandages)) {
            admin = true;
            const data = await this.prisma.category.findMany({ where: { only_admins: true } });
            available = data.some(val => filters?.includes(val.id));
        }

        const category = available ? undefined : { none: { only_admins: true } };

        const where: Prisma.BandageWhereInput = {
            categories: category,
            access_level: !admin ? 2 : undefined,
            OR: search_rule,
            AND: filters_rule,
        };

        const data = await this.prisma.bandage.findMany({
            where: where,
            include: {
                User: { include: { UserSettings: true } },
                stars: true,
                categories: true
            },
            take: Math.min(take, 100),
            skip: take * page,
            orderBy: constructSort(sort)
        });

        const count = await this.prisma.bandage.count({ where: where });
        const result = generate_response(data, session, available);
        return { data: result, totalCount: count, next_page: result.length ? page + 1 : page };
    }

    async setStar(session: Session, set: boolean, id: string) {
        /* set star to bandage by external id */

        const bandage = await this.prisma.bandage.findFirst({ where: { externalId: id } });
        if (!bandage) {
            return {
                statusCode: 404,
                message: "Bandage not found",
                message_ru: 'Повязка не найдена',
            };
        }

        const new_data = await this.prisma.bandage.update({
            where: { id: bandage.id },
            data: { stars: set ? { connect: { id: session.user.id } } : { disconnect: { id: session.user.id } } },
            include: { stars: true }
        });

        return {
            statusCode: 200,
            new_count: new_data.stars.length,
            action_set: set,
        }
    }

    async createBandage(body: CreateBandageDto, session: Session) {
        /* create bandage */

        let categories = [{ id: moderation_id[0] }];  // default categories
        if (body.categories !== undefined) {
            const validated_categories = await this.validateCategories(body.categories, hasAccess(session.user, RolesEnum.SuperAdmin));
            categories = [
                ...validated_categories.map(el => ({ id: el })),
                ...categories
            ];
        }

        const count = await this.prisma.bandage.count({
            where: {
                userId: session.user.id,
                categories: { some: { id: moderation_id[0] } }
            }
        });  // get count of under review works

        if (count >= 5) {
            return {
                statusCode: 400,
                message: "You cannot create more than 5 bandages under review",
                message_ru: "Вы не можете иметь более 5 повязок на проверке, дождитесь проверки остальных и повторите попытку"
            }
        }

        const result = await this.prisma.bandage.create({
            data: {
                externalId: Math.random().toString(36).substring(2, 8),
                title: body.title,
                description: body.description,
                base64: body.base64,
                base64_slim: body.base64_slim ?? '',
                split_type: body.split_type ?? false,
                User: { connect: { id: session.user.id } },
                categories: { connect: categories }
            }
        });

        await this.discordNotifications.doNotification(`<@&${process.env.MENTION_ROLE_ID}> New bandage "${result.title}" created by ${session.user.name}!\nhttps://pplbandage.ru/workshop/${result.externalId}`);
        await this.notifications.createNotification(session.user.id, {
            content: `Повязка <a href="/workshop/${result.externalId}"><b>${result.title}</b></a> создана и отправлена на проверку!`
        });

        return {
            statusCode: 201,
            external_id: result.externalId,
        };
    }

    async getCategories(for_edit: boolean, session: Session) {
        /* get list of categories */

        const admin = hasAccess(session?.user, RolesEnum.ManageBandages);
        const categories = await this.prisma.category.findMany({
            where: for_edit ? {
                reachable: admin ? undefined : true,
                only_admins: admin ? undefined : false
            } : {
                only_admins: admin ? undefined : false
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

    async _getBandage(id: string, session: Session | null) {
        const bandage = await this.prisma.bandage.findFirst({
            where: { externalId: id },
            include: { User: { include: { UserSettings: true } }, categories: true, stars: true }
        });
        if (!bandage) {
            return null;
        }
        const hidden = bandage.categories.some(val => val.only_admins);
        const no_access = session ? !hasAccess(session.user, RolesEnum.ManageBandages) && session.user.id !== bandage.User?.id : true;
        if ((hidden || bandage.access_level === 0) && no_access) {
            return null;
        }

        return bandage;
    }

    async getDataForOg(id: string) {
        const bandage = await this._getBandage(id, null);

        if (!bandage) {
            return {
                statusCode: 404,
                message: "Bandage not found",
                message_ru: 'Повязка не найдена',
            };
        }

        const buff = Buffer.from(bandage.base64, 'base64');
        const { data } = await sharp(buff)
            .resize(1, 1, { fit: 'inside' })
            .extract({ left: 0, top: 0, width: 1, height: 1 })
            .raw()
            .toBuffer({ resolveWithObject: true });
        const [r, g, b] = data;

        return {
            statusCode: 200,
            data: {
                id: bandage.id,
                external_id: bandage.externalId,
                title: bandage.title,
                description: bandage.description,
                average_og_color: rgbToHex(r, g, b),
                stars_count: bandage.stars.length,
                author: {
                    id: bandage.User?.id,
                    name: bandage.User?.reserved_name || bandage.User?.name,
                    username: bandage.User?.username,
                    public: bandage.User && Number(bandage.User?.discordId) > 0 ? bandage.User?.UserSettings?.public_profile : false
                }
            }
        }
    }

    async getBandage(id: string, session: Session) {
        /* get bandage by external id */

        const bandage = await this._getBandage(id, session);

        if (!bandage) {
            return {
                statusCode: 404,
                message: "Bandage not found",
                message_ru: 'Повязка не найдена',
            };
        }

        const hidden = bandage.categories.some(val => val.only_admins);
        let permissions_level = 0;
        if (session) {
            if (session.user.id === bandage.User?.id) permissions_level = 1;
            if (hasAccess(session.user, RolesEnum.ManageBandages) || (session.user.id === bandage.User?.id && hidden)) permissions_level = 2;
            if (hasAccess(session.user, RolesEnum.ForbidSelfHarm, true)) permissions_level = 0;
            if (bandage.archived && !hasAccess(session.user, RolesEnum.ManageBandages)) permissions_level = 0;
        }

        const me_profile = session && session.user.profile && session.user.UserSettings?.autoload ? {
            uuid: session.user.profile.uuid,
            nickname: session.user.profile.nickname
        } : undefined;

        const categories = bandage.categories.map(cat => {
            return {
                id: cat.id,
                name: cat.name,
                icon: cat.icon
            }
        });

        let check = null;
        if (bandage.categories.some(val => val.id === moderation_id[0])) check = "under review";
        if (bandage.categories.some(val => val.id === moderation_id[1])) check = "denied";


        return {
            statusCode: 200,
            data: {
                id: bandage.id,
                external_id: bandage.externalId,
                title: bandage.title,
                description: bandage.description,
                base64: bandage.base64,
                base64_slim: bandage.split_type ? bandage.base64_slim : undefined,
                split_type: bandage.split_type,
                creation_date: bandage.creationDate,
                stars_count: bandage.stars.length,
                starred: bandage.stars.some(val => val.id == session?.user.id),
                author: {
                    id: bandage.User?.id,
                    name: bandage.User?.reserved_name || bandage.User?.name,
                    username: bandage.User?.username,
                    public: bandage.User && Number(bandage.User?.discordId) > 0 ? bandage.User?.UserSettings?.public_profile : false
                },
                categories: categories,
                me_profile: me_profile,
                permissions_level: permissions_level,
                access_level: bandage.access_level,
                check_state: check
            }
        }

    }

    async updateBandage(id: string, body: EditBandageDto, session: Session) {
        /* update bandage info */

        const bandage = await this.prisma.bandage.findFirst({ where: { externalId: id }, include: { User: true, categories: true, stars: true } });

        if (!bandage) {
            return {
                statusCode: 404,
                message: "Not found",
                message_ru: 'Повязка не найдена',
            }
        }

        if (bandage.User?.id !== session.user.id && !hasAccess(session.user, RolesEnum.ManageBandages)) {
            return {
                statusCode: 403,
                message: "Forbidden",
                message_ru: 'У вас нет прав для выполнения этого действия',
            }
        }

        if (
            hasAccess(session.user, RolesEnum.ForbidSelfHarm, true) ||
            (bandage.archived && !hasAccess(session.user, RolesEnum.ManageBandages))
        ) {
            return {
                statusCode: 403,
                message: "Forbidden",
                message_ru: 'У вас нет прав для выполнения этого действия',
            };
        }

        let title = undefined;
        let description = undefined;
        let categories = undefined;
        let access_level = undefined;

        const hidden = bandage.categories.some(val => val.only_admins);
        const admin = hasAccess(session.user, RolesEnum.ManageBandages);

        if (admin || hidden) {
            if (body.title !== undefined) title = body.title;
            if (body.description !== undefined) description = body.description;
        }

        if (body.categories !== undefined) {
            const validated_categories = await this.validateCategories(body.categories, admin);
            const bandage_categories = bandage?.categories.map(el => el.id);
            if (!admin) {
                if (bandage_categories?.includes(moderation_id[0])) validated_categories.push(moderation_id[0]);
                if (bandage_categories?.includes(moderation_id[1])) validated_categories.push(moderation_id[1]);
                if (bandage_categories?.includes(official_id)) validated_categories.push(official_id);
            }

            const difference = bandage_categories.filter(element => !validated_categories.includes(element));
            const difference_after = validated_categories.filter(element => !bandage_categories.includes(element));
            if (difference_after.includes(moderation_id[1])) {
                await this.notifications.createNotification(bandage.userId, {
                    content: `Повязка <a href="/workshop/${bandage.externalId}"><b>${bandage.title}</b></a> была отклонена. Пожалуйста, свяжитесь с <a href="/contacts"><b>администрацией</b></a> для уточнения причин.`,
                    type: 2
                });
            }

            else if (moderation_id.some(element => difference.includes(element))) {
                await this.notifications.createNotification(bandage.userId, {
                    content: `Повязка <a href="/workshop/${bandage.externalId}"><b>${bandage.title}</b></a> успешно прошла проверку и теперь доступна остальным в <a href="/workshop"><b>мастерской</b></a>!`,
                    type: 1
                });
            }
            categories = validated_categories.map(el => ({ id: el }));
        }

        if (body.access_level !== undefined) {
            const check_al = body.access_level;
            if (!isNaN(check_al) && check_al >= 0 && check_al <= 2) access_level = check_al;
        }

        await this.prisma.bandage.update({
            where: {
                id: bandage?.id
            },
            data: {
                title: title,
                description: description,
                categories: {
                    set: categories
                },
                access_level: access_level
            }
        });

        return { statusCode: 200 };
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

        const bandage = await this.prisma.bandage.findFirst({ where: { externalId: externalId }, include: { User: true } });
        if (!bandage) {
            return {
                statusCode: 404,
                message: "Not found",
                message_ru: 'Повязка не найдена',
            };
        }

        if (!hasAccess(session.user, RolesEnum.ManageBandages) && session.user.id !== bandage.User?.id) {
            return {
                statusCode: 403,
                message: "Forbidden",
                message_ru: 'У вас нет прав для выполнения этого действия',
            };
        }

        if (
            hasAccess(session.user, RolesEnum.ForbidSelfHarm, true) ||
            (bandage.archived && !hasAccess(session.user, RolesEnum.ManageBandages))
        ) {
            return {
                statusCode: 403,
                message: "Forbidden",
                message_ru: 'У вас нет прав для выполнения этого действия',
            };
        }

        await this.prisma.bandage.delete({ where: { id: bandage.id } });
        return {
            statusCode: 200,
            message: "Deleted",
            message_ru: 'Успешно удалено'
        }
    }

    async validateBandage(base64: string, heightInit?: number) {
        let height = null;
        try {
            const bandage_buff = Buffer.from(base64, 'base64');
            const bandage_sharp = sharp(bandage_buff);
            const metadata = await bandage_sharp.metadata();
            const width = metadata.width as number;
            height = metadata.height as number;

            if (width !== 16 || (height < 2 || height > 24 || height % 2 !== 0) || metadata.format !== 'png') {
                return {
                    statusCode: 400,
                    message: "Invalid bandage size or format!",
                    message_ru: "Повязка должна иметь ширину 16 пикселей, высоту от 2 до 24 пикселей и четную высоту"

                };
            }

            if (heightInit != undefined && height !== heightInit) {
                return {
                    statusCode: 400,
                    message: "The second bandage should be the same height as the first",
                    message_ru: "Вторая повязка должна иметь такую ​​же высоту, как и первая"

                };
            }
        } catch {
            return {
                statusCode: 500,
                message: "Error while processing base64",
                message_ru: "Произошла ошибка при обработке base64"

            };
        }

        return {
            statusCode: 200,
            height: height
        };
    }

    async archiveBandage(session: Session, externalId: string) {
        const bandage = await this.prisma.bandage.findFirst({ where: { externalId: externalId }, include: { User: true } });
        if (!bandage) {
            return {
                statusCode: 404,
                message: 'Not found',
                message_ru: 'Повязка не найдена',
            };
        }

        if (!hasAccess(session.user, RolesEnum.ManageBandages) && session.user.id !== bandage.User?.id) {
            return {
                statusCode: 403,
                message: 'Forbidden',
                message_ru: 'У вас нет прав для выполнения этого действия',
            };
        }

        await this.prisma.bandage.update({ where: { externalId: externalId }, data: { archived: true } });

        return {
            statusCode: 200,
            message: 'Archived',
            message_ru: 'Успешно архивировано'
        }
    }
}
