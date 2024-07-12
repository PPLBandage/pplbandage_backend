import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UserService } from './user.module';

@Injectable()
export class NotificationService {
    constructor(private prisma: PrismaService,
        private user: UserService,
    ) { }

    get(session: Session) {
        return session.user.notifications;
    }

    async createNotification(userId: number, notification: Notifications) {
        const notification_db = await this.prisma.notifications.create({
            data: {
                users: { connect: { id: userId } },
                content: notification.content,
                author: notification.author,
                type: notification.type
            }
        });
        return notification_db;
    }

    async createNotificationEveryone(notification: Notifications) {
        const notification_db = await this.prisma.notifications.create({ data: notification });

        const users = await this.prisma.user.findMany();
        users.forEach((user) => {
            this.prisma.notifications.update({
                where: { id: notification_db.id },
                data: { users: { connect: { id: user.id } } }
            });
        });
        return notification_db;
    }
}
