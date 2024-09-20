import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Session } from 'src/oauth/oauth.service';

/*
@types:
0 - standard notification
1 - moderation pass
2 - moderation denied
*/

@Injectable()
export class NotificationService {
    constructor(private prisma: PrismaService) { }

    async get(session: Session, take: number, page: number) {
        await this.prisma.user.update({ where: { id: session.user.id }, data: { has_unreaded_notifications: false } });
        const notifications = await this.prisma.notifications.findMany({
            where: { users: { some: { id: session.user.id } } },
            take: Math.max(1, take),
            skip: Math.max(0, take * page),
            orderBy: {
                creation_date: 'desc'
            }
        });

        const count = await this.prisma.notifications.count({ where: { users: { some: { id: session.user.id } } } });
        return { data: notifications, total_count: count };
    }

    async createNotification(userId: string | null, notification: Notifications) {
        if (!userId) return;
        const notification_db = await this.prisma.notifications.create({
            data: {
                users: { connect: { id: userId } },
                content: notification.content,
                author: notification.author,
                type: notification.type
            }
        });

        await this.prisma.user.update({ where: { id: userId }, data: { has_unreaded_notifications: true } });
        return notification_db;
    }

    async createNotificationEveryone(notification: Notifications) {
        const notification_db = await this.prisma.notifications.create({ data: notification });
        const users = await this.prisma.user.findMany();

        users.forEach(user => {
            this.prisma.user.update({
                where: { id: user.id },
                data: {
                    has_unreaded_notifications: true,
                    notifications: { connect: { id: notification_db.id } }
                }
            });
        });
        return notification_db;
    }
}
