import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UserService } from './user.module';
import { Mutex } from 'async-mutex';
import { Prisma } from '@prisma/client';

const mutex = new Mutex();
const moderation_id = [4, 13];

interface BandageSerch {
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
    description: string,
    base64: string,
    creationDate: Date
}

const generate_response = (data: Bandage[], session: Session | null) => {
    const result = data.map((el) => {
        const categories = el.categories.map((cat) => {
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
            categories: categories
        }
    })
    return result;
}

@Injectable()
export class BandageService {
    constructor(private prisma: PrismaService,
        private users: UserService,
    ) { }

    async getBandages(sessionId: string,
        take: number,
        page: number,
        search?: string,
        filters?: string,
        sort?: string) {

        const session = await this.users.validateSession(sessionId);
        let filter_rule: BandageSerch[] | undefined = undefined;
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
        if (session) {
            if (session.user) {
                if (session.user.admin) {
                    const data = await this.prisma.category.findMany({ where: { only_admins: true }});
                    const contains = Object.values(data).some(val => filters_list?.includes(String(val.id)));
                    available = contains;
                }
            }
        }

        const where = {
            categories: {
                some: {
                    only_admins: available ? undefined : false
                }
            },
            OR: filter_rule,
            AND: filters_rule
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

        const count = await this.prisma.bandage.count({ where: where })
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

        const release = await mutex.acquire()
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
        release();
        return {
            message: "",
            new_count: new_data.stars.length,
            action_set: set,
            statusCode: 200
        }
    }

    async createBandage(base64: string,
        title: string,
        description: string,
        sessionId: string) {
        const session = await this.users.validateSession(sessionId);
        const result = await this.prisma.bandage.create({
            data: {
                externalId: Math.random().toString(36).substring(2, 8),
                title: title,
                description: description,
                base64: base64,
                User: {
                    connect: {
                        id: session?.user.id
                    }
                },
                categories: {
                    connect: {
                        id: moderation_id[0]
                    }
                }
            }
        });
        return {
            message: "",
            external_id: result.externalId,
            statusCode: 200
        }
    }

    async getCategories(for_edit: boolean, sessionId: string) {
        const session = await this.users.validateSession(sessionId);
        let admin: boolean | undefined = false;
        if (session) {
            if (session.user) admin = session.user.admin ? undefined : false;
        }
        const categories = await this.prisma.category.findMany({
            where: for_edit ? {
                reachable: true,
                only_admins: admin
            } : {
                only_admins: admin
            }, select: { id: true, name: true, icon: true }
        });
        return categories;
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
        const bandage = await this.prisma.bandage.findFirst({where: {externalId: id}, include: {User: true, categories: true, stars: true}});
        if (!bandage) {
            return {
                message: "Bandage not found",
                statusCode: 404
            };
        }
        const hidden = Object.values(bandage.categories).some(val => val.only_admins);
        if (hidden && (session ? (!session.user.admin || session.user.id !== bandage.User?.id) : true)) {
            return {
                message: "Bandage not found",
                statusCode: 404
            };
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
        })

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
                categories: categories,
                me_profile: me_profile
            }
        }
        
    }
}