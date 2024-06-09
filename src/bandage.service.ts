import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UserService } from './user.module';
import {Mutex} from 'async-mutex';

const mutex = new Mutex();

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

@Injectable()
export class BandageService {
    constructor(private prisma: PrismaService,
                private users: UserService,
    ) { }

    async getBandages(sessionId: string,
                      take: number,
                      page: number,
                      search?: string) {
        let filter_rule: BandageSerch[] | undefined = undefined;
        if (search){
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
        const data = await this.prisma.bandage.findMany({ 
            where: { 
                verified: true,
                OR: filter_rule
            }, 
            include: {
                User: true,
                stars: true
            }, 
            take: Math.min(take, 100),
            skip: take * page
        });
        const session = await this.users.validateSession(sessionId);
        const count = await this.prisma.bandage.count({where: { verified: true, OR: filter_rule }})
        const result = data.map((el) => {
            return {
                id: el.id,
                external_id: el.externalId,
                title: el.title,
                description: el.description,
                base64: el.base64,
                creation_date: el.creationDate,
                stars_count: el.stars.length,
                starred: Object.values(el.stars).some(val => val.id == session?.user_id),
                colorable: el.colorable,
                User: {
                    id: el.User.id,
                    name: el.User.name,
                    username: el.User.username
                }
            }
        })
        return {data: result, totalCount: count};
    }

    async setStar(session: { sessionId: string; cookie: string; user_id: number; }, set: boolean, id: string) {
        const bandage = await this.prisma.bandage.findFirst({where: {externalId: id}});
        if (!bandage) { 
            return {
                status: "error",
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
                    stars: set ? { connect: { id: session.user_id } } : { disconnect: { id: session.user_id } }
                },
                include: {
                    stars: true
                }
            });
        release();
        return {
            status: "success",
            message: "",
            new_count: new_data.stars.length,
            action_set: set,
            statusCode: 200
        }
    }

    async createBandage(base64: string, 
                        title: string, 
                        description: string, 
                        sessionId: string){
        const session = await this.users.validateSession(sessionId);
        const result = await this.prisma.bandage.create({
            data: {
                externalId: Math.random().toString(36).substring(2, 8),
                title: title,
                description: description,
                base64: base64,
                User: {
                    connect: {
                        id: session?.user_id
                    }
                }
            }
        });
        return {
            status: "success",
            message: "",
            external_id: result.externalId,
            statusCode: 200
        }
    }
}