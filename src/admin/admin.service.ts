import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdminService {
    constructor(private readonly prisma: PrismaService) {}

    async getUsersData() {
        const users = await this.prisma.user.findMany({
            include: { Bandage: true }
        });

        const users_count = users.length;
        const registrations_sorted = users.sort(
            (a, b) =>
                new Date(a.joined_at).getTime() -
                new Date(b.joined_at).getTime()
        );
        const first_reg = registrations_sorted[0];
        const last_reg = registrations_sorted[registrations_sorted.length - 1];
        const activity_period =
            (new Date(last_reg.joined_at).getTime() -
                new Date(first_reg.joined_at).getTime()) /
            (1000 * 60 * 60 * 24);

        const regsByDay = users.reduce(
            (acc, user) => {
                const day = new Date(user.joined_at).toLocaleDateString(
                    'en-CA'
                ); // YYYY-MM-DD
                acc[day] = (acc[day] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );

        const unique_reg_days = Object.keys(regsByDay).length;
        const avg_reg = users_count / unique_reg_days;

        let top_day = null;
        let max_regs = 0;

        for (const [day, count] of Object.entries(regsByDay)) {
            if (count > max_regs) {
                max_regs = count;
                top_day = {
                    day,
                    registrations: count
                };
            }
        }

        return {
            users_count,
            first_reg: {
                date: first_reg.joined_at,
                name: first_reg.name
            },
            last_reg: {
                date: last_reg.joined_at,
                name: last_reg.name
            },
            activity_period,
            unique_reg_days,
            avg_reg,
            top_day
        };
    }
}
