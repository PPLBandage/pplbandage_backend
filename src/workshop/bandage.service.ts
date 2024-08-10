import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.module';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import * as sharp from 'sharp';
import { generate_response } from '../app.service';
import { NotificationService } from '../notifications/notifications.service';
import { Session } from 'src/oauth/oauth.module';

const moderation_id = [4, 13];  // на проверке, отклонено
const official_id = 0;
const discord_url = "https://discord.com/api/v10";

interface BandageSearch {
    title?: { contains: string },
    description?: { contains: string },
    externalId?: { contains: string; },
    User?: { name: { contains: string } }
}

const constructSort = (sort?: string): Prisma.BandageOrderByWithRelationInput => {
    /* generate sort rule */

    switch (sort) {
        case "popular_up":
            return { stars: { _count: 'desc' } };
        case "date_up":
            return { creationDate: 'desc' };
        case "name_up":
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
        private users: UserService,
        private notifications: NotificationService
    ) { }

    async getBandagesCount() {
        return await this.prisma.bandage.count();
    }

    async getBandages(session: Session,
        take: number,
        page: number,
        search?: string,
        filters?: string,
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

        const filters_list = filters?.split(',').filter(el => !isNaN(Number(el)) && el != '');
        const filters_rule = filters_list?.map(el => { return { categories: { some: { id: Number(el) } } }; });

        let available = false;
        let admin = false;
        if (session && session.user && session.user.UserSettings?.admin) {
            admin = true;
            const data = await this.prisma.category.findMany({ where: { only_admins: true } });
            available = Object.values(data).some(val => filters_list?.includes(String(val.id)));
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
                message: "Bandage not found",
                statusCode: 404
            };
        }

        const new_data = await this.prisma.bandage.update({
            where: { id: bandage.id },
            data: { stars: set ? { connect: { id: session.user.id } } : { disconnect: { id: session.user.id } } },
            include: { stars: true }
        });

        return {
            new_count: new_data.stars.length,
            action_set: set,
            statusCode: 200
        }
    }

    async createBandage(body: CreateBody, session: Session) {
        /* create bandage */

        let categories = [{ id: moderation_id[0] }];  // default categories
        if (body.categories !== undefined) {
            const validated_categories = await this.validateCategories(body.categories, Boolean(session.user.UserSettings?.admin));
            categories = [...validated_categories.map((el) => {
                return { id: el };
            }), ...categories];
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
                base64_slim: body.base64_slim || '',
                split_type: body.split_type || false,
                User: {
                    connect: {
                        id: session?.user.id
                    }
                },
                categories: {
                    connect: categories
                }
            }
        });

        await axios.post(`${discord_url}/channels/${process.env.MODERATION_CHANNEL_ID}/messages`, {
            content: `<@&${process.env.MENTION_ROLE_ID}> New bandage "${result.title}" created by ${session.user.name}!\nhttps://pplbandage.ru/workshop/${result.externalId}`
        }, {
            validateStatus: () => true,
            headers: {
                Authorization: `Bot ${process.env.BOT_TOKEN}`
            }
        });

        this.notifications.createNotification(session.user.id, {
            content: `Повязка <a href="/workshop/${result.externalId}"><b>${result.title}</b></a> создана и отправлена на проверку!`
        });

        return {
            external_id: result.externalId,
            statusCode: 201
        };
    }

    async getCategories(for_edit: boolean, session: Session) {
        /* get list of categories */

        let admin: boolean = false;
        if (session && session.user) {
            admin = Boolean(session.user.UserSettings?.admin);
        }

        const categories = await this.prisma.category.findMany({
            where: for_edit ? {
                reachable: admin ? undefined : true,
                only_admins: admin ? undefined : false
            } : {
                only_admins: admin ? undefined : false
            }, select: { id: true, name: true, icon: true },
            orderBy: { order: 'asc' }
        });
        return categories;
    }

    async getBandage(id: string, session: Session) {
        /* get bandage by external id */

        const bandage = await this.prisma.bandage.findFirst({
            where: { externalId: id },
            include: { User: { include: { UserSettings: true } }, categories: true, stars: true }
        });
        if (!bandage) {
            return {
                message: "Bandage not found",
                statusCode: 404
            };
        }
        const hidden = Object.values(bandage.categories).some(val => val.only_admins) || bandage.access_level === 0;
        const access = session ? (!session.user.UserSettings?.admin && session.user.id !== bandage.User?.id) : true;
        if (hidden && access) {
            return {
                message: "Bandage not found",
                statusCode: 404
            };
        }

        let permissions_level = 0;
        if (session) {
            if (session.user.id === bandage.User?.id) permissions_level = 1;
            if (session.user.UserSettings?.admin || (session.user.id === bandage.User?.id && hidden)) permissions_level = 2;
        }

        const me_profile = session && session.user.profile && session.user.UserSettings?.autoload ? {
            uuid: session.user.profile.uuid,
            nickname: session.user.profile.nickname
        } : undefined;

        const categories = bandage.categories.map((cat) => {
            return {
                id: cat.id,
                name: cat.name,
                icon: cat.icon
            }
        });

        let check = null;
        if (Object.values(bandage.categories).some(val => val.icon.includes("clock.svg"))) check = "under review";
        if (Object.values(bandage.categories).some(val => val.icon.includes("denied.svg"))) check = "denied";

        const buff = Buffer.from(bandage.base64, 'base64');
        const { data, info } = await sharp(buff).resize(1, 1, { fit: 'inside' }).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
        const [r, g, b, a] = data;

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
                average_og_color: rgbToHex(r, g, b),
                creation_date: bandage.creationDate,
                stars_count: bandage.stars.length,
                starred: Object.values(bandage.stars).some(val => val.id == session?.user.id),
                author: {
                    id: bandage.User?.id,
                    name: bandage.User?.name,
                    username: bandage.User?.username,
                    public: bandage.User?.UserSettings?.public_profile
                },
                categories: categories,
                me_profile: me_profile,
                permissions_level: permissions_level,
                access_level: bandage.access_level,
                check_state: check
            }
        }

    }

    async updateBandage(id: string, body: CreateBody, session: Session) {
        /* update bandage info */

        const bandage = await this.prisma.bandage.findFirst({ where: { externalId: id }, include: { User: true, categories: true, stars: true } });

        if (!bandage) {
            return {
                statusCode: 404,
                message: "Not found"
            }
        }

        if (bandage.User?.id !== session.user.id && !session.user.UserSettings?.admin) {
            return {
                statusCode: 403,
                message: "Forbidden"
            }
        }

        let title = undefined;
        let description = undefined;
        let categories = undefined;
        let access_level = undefined;

        const hidden = Object.values(bandage.categories).some(val => val.only_admins);

        if (session.user.UserSettings?.admin || hidden) {
            if (body.title !== undefined) title = body.title;
            if (body.description !== undefined) description = body.description;
        }

        if (body.categories !== undefined) {
            const validated_categories = await this.validateCategories(body.categories, Boolean(session.user.UserSettings?.admin));
            const bandage_categories = bandage?.categories.map(el => el.id);
            if (!session.user.UserSettings?.admin) {
                if (bandage_categories?.includes(moderation_id[0])) validated_categories.push(moderation_id[0]);
                if (bandage_categories?.includes(moderation_id[1])) validated_categories.push(moderation_id[1]);
                if (bandage_categories?.includes(official_id)) validated_categories.push(official_id);
            }

            const difference = bandage_categories.filter((element) => !validated_categories.includes(element));
            const difference_after = validated_categories.filter((element) => !bandage_categories.includes(element));
            if (difference_after.includes(moderation_id[1])) {
                this.notifications.createNotification(bandage.userId as number, {
                    content: `Повязка <a href="/workshop/${bandage.externalId}"><b>${bandage.title}</b></a> была отклонена. Пожалуйста, свяжитесь с <a href="/contacts"><b>администрацией</b></a> для уточнения причин.`,
                    type: 2
                });
            }

            else if (moderation_id.some(element => difference.includes(element))) {
                this.notifications.createNotification(bandage.userId as number, {
                    content: `Повязка <a href="/workshop/${bandage.externalId}"><b>${bandage.title}</b></a> успешно прошла проверку и теперь доступна остальным в <a href="/workshop"><b>мастерской</b></a>!`,
                    type: 1
                });
            }
            categories = validated_categories.map((el) => { return { id: el }; });
        }

        if (body.access_level !== undefined) {
            const check_al = Number(body.access_level);
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
        return categories.filter((el) => reachable_ids.includes(el));
    }

    async deleteBandage(session: Session, externalId: string) {
        /* delete bandage */

        const bandage = await this.prisma.bandage.findFirst({ where: { externalId: externalId }, include: { User: true } });
        if (!bandage) {
            return {
                statusCode: 404,
                message: "Not found"
            };
        }

        if (!session.user.UserSettings?.admin && session.user.id !== bandage.User?.id) {
            return {
                statusCode: 403,
                message: "Forbidden"
            };
        }

        await this.prisma.bandage.delete({ where: { id: bandage.id } });
        return {
            statusCode: 200,
            message: "Deleted"
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

            if (width != 16 || (height < 2 || height > 24 || height % 2 != 0) || metadata.format != 'png') {
                return {
                    statusCode: 400,
                    data: {
                        message: "Invalid bandage size or format!",
                        message_ru: "Повязка должна иметь ширину 16 пикселей, высоту от 2 до 24 пикселей и четную высоту"
                    }
                };
            }

            if (heightInit != undefined && height !== heightInit) {
                return {
                    statusCode: 400,
                    data: {
                        message: "The second bandage should be the same height as the first",
                        message_ru: "Вторая повязка должна иметь такую ​​же высоту, как и первая"
                    }
                };
            }
        } catch {
            return {
                statusCode: 500,
                data: {
                    message: "Error while processing base64",
                    message_ru: "Произошла ошибка при обработке base64"
                }
            };
        }

        return {
            statusCode: 200,
            data: {
                height: height
            }
        };
    }
}
