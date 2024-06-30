import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UserService } from './user.module';
import { Prisma } from '@prisma/client';
import axios from 'axios';

const moderation_id = [4, 13];  // на проверке, отклонено
const common_id = 15;
const official_id = 0;
const discord_url = "https://discord.com/api/v10";

interface BandageSearch {
    title?: {
        contains: string;
    },
    description?: {
        contains: string;
    },
    externalId?: {
        contains: string;
    },
    User?: {
        name: {
            contains: string
        }
    }
}

const constructSort = (sort?: string): Prisma.BandageOrderByWithRelationInput => {
    switch (sort) {
        case "popular_up":
            return {
                stars: {
                    _count: 'desc'
                }
            };
        case "date_up":
            return {
                creationDate: 'desc'
            };
        case "name_up":
            return {
                title: 'asc'
            }
        default:
            return {}
    }
}

interface Bandage {
    User: {
        id: number;
        username: string;
        name: string;
        discordId: string;
        admin: boolean;
        banned: boolean;
        joined_at: Date;
    } | null;
    stars: {
        id: number;
        username: string;
        name: string;
        discordId: string;
        admin: boolean;
        banned: boolean;
        joined_at: Date;
    }[];
    categories: {
        id: number,
        name: string,
        icon: string
    }[];
    id: number,
    externalId: string,
    title: string,
    description: string | null,
    base64: string,
    creationDate: Date
}

const generate_response = (data: Bandage[], session: Session | null) => {
    const result = data.map((el) => {
        if (el.User?.banned) return undefined;
        const categories = el.categories.map((cat) => {
            if (cat.icon === '/null') return;
            return {
                id: cat.id,
                name: cat.name,
                icon: cat.icon
            }
        })
        return {
            id: el.id,
            external_id: el.externalId,
            title: el.title,
            description: el.description,
            base64: el.base64,
            creation_date: el.creationDate,
            stars_count: el.stars.length,
            starred: Object.values(el.stars).some(val => val.id == session?.user.id),
            author: {
                id: el.User?.id,
                name: el.User?.name,
                username: el.User?.username
            },
            categories: categories.filter((el) => el !== undefined)
        }
    });

    return result.filter((el) => el !== undefined);
}

@Injectable()
export class BandageService {
    constructor(private prisma: PrismaService,
        private users: UserService,
    ) {}

    async getBandages(sessionId: string,
        take: number,
        page: number,
        search?: string,
        filters?: string,
        sort?: string) {

        const session = await this.users.validateSession(sessionId);
        let filter_rule: BandageSearch[] | undefined = undefined;
        if (search) {
            filter_rule = [
                {
                    title: {
                        contains: search
                    }
                },
                {
                    description: {
                        contains: search
                    }
                },
                {
                    externalId: {
                        contains: search
                    }
                },
                {
                    User: {
                        name: {
                            contains: search
                        }
                    }
                }
            ];
        }

        const filters_list = filters?.split(',').filter(el => !isNaN(Number(el)) && el != '');
        const filters_rule = filters_list?.map(el => { return { categories: { some: { id: Number(el) } } }; });

        let available = false;
        if (session && session.user && session.user.admin) {
            const data = await this.prisma.category.findMany({ where: { only_admins: true } });
            available = Object.values(data).some(val => filters_list?.includes(String(val.id)));
        }

        const category = available ? undefined : { none: { only_admins: true } };

        const where: Prisma.BandageWhereInput = {
            categories: category,
            access_level: 2,
            OR: filter_rule,
            AND: filters_rule,
        };

        const data = await this.prisma.bandage.findMany({
            where: where,
            include: {
                User: true,
                stars: true,
                categories: true
            },
            take: Math.min(take, 100),
            skip: take * page,
            orderBy: constructSort(sort)
        });

        const count = await this.prisma.bandage.count({ where: where });
        const result = generate_response(data, session);
        return { data: result, totalCount: count, next_page: result.length ? page + 1 : page };
    }

    async setStar(session: Session, set: boolean, id: string) {
        const bandage = await this.prisma.bandage.findFirst({ where: { externalId: id } });
        if (!bandage) {
            return {
                message: "Bandage not found",
                statusCode: 404
            };
        }

        const new_data = await this.prisma.bandage.update({
            where: {
                id: bandage.id
            },
            data: {
                stars: set ? { connect: { id: session.user.id } } : { disconnect: { id: session.user.id } }
            },
            include: {
                stars: true
            }
        });
        return {
            message: "",
            new_count: new_data.stars.length,
            action_set: set,
            statusCode: 200
        }
    }

    async createBandage(body: CreateBody, session: Session) {
        let categories = [{ id: moderation_id[0] }, { id: common_id }];
        if (body.categories !== undefined) {
            const validated_categories = await this.validateCategories(body.categories, session.user.admin);
            categories = [...validated_categories.map((el) => {
                return { id: el };
            }), ...categories];
        }

        const count = await this.prisma.bandage.count({
            where: {
                userId: session.user.id,
                categories: {
                    some: {
                        id: moderation_id[0]
                    }
                }
            }
        });

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
            content: `New bandage "${result.title}" created by ${session.user.name}!\nhttps://pplbandage.ru/workshop/${result.externalId}`
        }, {
            validateStatus: () => true,
            headers: {
                Authorization: `Bot ${process.env.BOT_TOKEN}`
            }
        });

        return {
            external_id: result.externalId,
            statusCode: 201
        }
    }

    async getCategories(for_edit: boolean, sessionId: string) {
        const session = await this.users.validateSession(sessionId);
        let admin: boolean = false;
        if (session) {
            if (session.user) admin = session.user.admin;
        }
        const categories = await this.prisma.category.findMany({
            where: for_edit ? {
                reachable: admin ? undefined : true,
                only_admins: admin ? undefined : false
            } : {
                only_admins: admin ? undefined : false
            }, select: { id: true, name: true, icon: true }
        });
        return categories.filter(el => el.icon !== "/null");
    }


    async getWork(session: Session) {
        const result = await this.prisma.bandage.findMany({
            where: {
                userId: session.user.id
            },
            include: {
                stars: true,
                categories: true,
                User: true
            }
        });
        return { statusCode: 200, data: generate_response(result, session) }
    }

    async getStars(session: Session) {
        const result = await this.prisma.bandage.findMany({
            where: {
                stars: {
                    some: {
                        id: session.user.id
                    }
                },
                User: {
                    banned: false
                }
            },
            include: {
                stars: true,
                categories: true,
                User: true
            }
        });
        return { statusCode: 200, data: generate_response(result, session) }
    }

    async getBandage(id: string, sessionId: string) {
        const session = await this.users.validateSession(sessionId);
        const bandage = await this.prisma.bandage.findFirst({ where: { externalId: id }, include: { User: true, categories: true, stars: true } });
        if (!bandage) {
            return {
                message: "Bandage not found",
                statusCode: 404
            };
        }
        const hidden = Object.values(bandage.categories).some(val => val.only_admins) || bandage.access_level === 0;
        const access = session ? (!session.user.admin && session.user.id !== bandage.User?.id) : true;
        if (hidden && access) {
            return {
                message: "Bandage not found",
                statusCode: 404
            };
        }

        let permissions_level = 0;
        if (session) {
            if (session.user.id === bandage.User?.id) permissions_level = 1;
            if (session.user.admin || (session.user.id === bandage.User?.id && hidden)) permissions_level = 2;
        }

        const me_profile = session && session.user.profile && session.user.autoload ? {
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

        return {
            statusCode: 200,
            data: {
                id: bandage.id,
                external_id: bandage.externalId,
                title: bandage.title,
                description: bandage.description,
                base64: bandage.base64,
                creation_date: bandage.creationDate,
                stars_count: bandage.stars.length,
                starred: Object.values(bandage.stars).some(val => val.id == session?.user.id),
                author: {
                    id: bandage.User?.id,
                    name: bandage.User?.name,
                    username: bandage.User?.username
                },
                categories: categories.filter(el => el.icon !== '/null'),
                me_profile: me_profile,
                permissions_level: permissions_level,
                access_level: bandage.access_level,
                check_state: check
            }
        }

    }

    async updateBandage(id: string, body: CreateBody, session: Session) {
        const bandage = await this.prisma.bandage.findFirst({ where: { externalId: id }, include: { User: true, categories: true, stars: true } });

        if (!bandage) {
            return {
                statusCode: 404,
                message: "Not found"
            }
        }

        if (bandage?.User?.id !== session.user.id && !session.user.admin) {
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

        if (session.user.admin || hidden) {
            if (body.title !== undefined) title = body.title;
            if (body.description !== undefined) description = body.description;
        }

        if (body.categories !== undefined) {
            const validated_categories = await this.validateCategories(body.categories, session.user.admin);
            if (!session.user.admin) {
                const bandage_categories = bandage?.categories.map(el => el.id);
                if (bandage_categories?.includes(moderation_id[0])) validated_categories.push(moderation_id[0]);
                if (bandage_categories?.includes(moderation_id[1])) validated_categories.push(moderation_id[1]);
                if (bandage_categories?.includes(official_id)) validated_categories.push(official_id);
            }
            categories = validated_categories.map((el) => {
                return { id: el };
            });
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
        })

        return {
            statusCode: 200,
            message: ""
        }
    }

    async validateCategories(categories: number[], admin: boolean) {
        const reachable_categories = await this.prisma.category.findMany({
            where: {
                reachable: admin ? undefined : true
            }
        });

        const reachable_ids = reachable_categories.map(el => el.id);
        return categories.filter((el) => reachable_ids.includes(el));
    }

    async deleteBandage(session: Session, externalId: string) {
        const bandage = await this.prisma.bandage.findFirst({ where: { externalId: externalId }, include: { User: true } });
        if (!bandage) {
            return {
                statusCode: 404,
                message: "Not found"
            };
        }

        if (!session.user.admin && session.user.id !== bandage.User?.id) {
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
}
