import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BandageFull, Notifications, Session } from 'src/interfaces/interfaces';

/**
@types  
0 - standard notification  
1 - moderation pass  
2 - moderation denied  
*/
@Injectable()
export class NotificationService {
    constructor(private prisma: PrismaService) {}

    async get(session: Session, take: number, page: number) {
        await this.prisma.user.update({
            where: { id: session.user.id },
            data: { has_unreaded_notifications: false }
        });

        const notifications = await this.prisma.notifications.findMany({
            where: { users: { some: { id: session.user.id } } },
            take: Math.max(1, take),
            skip: Math.max(0, take * page),
            orderBy: {
                creation_date: 'desc'
            }
        });

        const count = await this.prisma.notifications.count({
            where: { users: { some: { id: session.user.id } } }
        });
        return { data: notifications, total_count: count };
    }

    async createNotification(
        userId: string | null,
        notification: Notifications
    ) {
        if (!userId) return;
        const notification_db = await this.prisma.notifications.create({
            data: {
                users: { connect: { id: userId } },
                content: notification.content,
                author: notification.author,
                type: notification.type
            }
        });

        await this.prisma.user.update({
            where: { id: userId },
            data: { has_unreaded_notifications: true }
        });
        return notification_db;
    }

    async createNotificationEveryone(notification: Notifications) {
        const notification_db = await this.prisma.notifications.create({
            data: notification
        });
        const users = await this.prisma.user.findMany();

        await Promise.all(
            users.map(async user => {
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        has_unreaded_notifications: true,
                        notifications: { connect: { id: notification_db.id } }
                    }
                });
            })
        );
        return notification_db;
    }

    /** Create bandage approval notification to related user */
    async createApproveNotification(bandage: BandageFull) {
        await this.createNotification(bandage.userId, {
            content:
                `Повязка <a href="/workshop/${bandage.externalId}?ref=/me/notifications"><b>${bandage.title}</b></a> ` +
                `успешно прошла проверку и теперь доступна остальным в <a href="/workshop"><b>мастерской</b></a>!`,
            type: 1
        });

        if (bandage.BandageModeration?.is_first) {
            await this.createBandageCreationSubscribers(bandage);
        }
    }

    /** Create bandage deny notification to related user */
    async createDenyNotification(bandage: BandageFull) {
        await this.createNotification(bandage.userId, {
            content:
                `Повязка <a href="/workshop/${bandage.externalId}?ref=/me/notifications"><b>${bandage.title}</b></a> ` +
                `была отклонена. Пожалуйста, свяжитесь с <a href="/contacts"><b>администрацией</b></a> для уточнения причин.`,
            type: 2
        });
    }

    /** Create bandage creation notification to related user */
    async createBandageCreationNotification(bandage: BandageFull) {
        await this.createNotification(bandage.User.id, {
            content:
                `Повязка <a href="/workshop/${bandage.externalId}?ref=/me/notifications"><b>${bandage.title}</b></a> ` +
                `создана и отправлена на проверку!`
        });
    }

    /** Create bandage creation notification for user's subscribers */
    async createBandageCreationSubscribers(bandage: BandageFull) {
        const author = await this.prisma.user.findFirst({
            where: { id: bandage.userId },
            include: { subscribers: true }
        });

        if (!author) return;

        const content =
            `<a href="/users/${author.username}?ref=/me/notifications"><b>${author.name}</b></a> опубликовал(а) новую повязку ` +
            `<a href="/workshop/${bandage.externalId}?ref=/me/notifications"><b>${bandage.title}</b></a>!`;

        await Promise.all(
            author.subscribers.map(async subscriber => {
                await this.createNotification(subscriber.id, {
                    content,
                    type: 0
                });
            })
        );
    }
}
