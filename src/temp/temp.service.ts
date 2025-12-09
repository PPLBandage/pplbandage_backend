import { Injectable, NotFoundException } from '@nestjs/common';
import { Session } from 'src/interfaces/interfaces';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TempService {
    constructor(private readonly prisma: PrismaService) {}

    async redeemExclusiveBadge(session: Session) {
        const exclusiveBadgeId = 6;
        const user = await this.prisma.user.findFirstOrThrow({
            where: { id: session.user.id },
            include: { badges: true }
        });

        if (user.badges.some(el => el.internal_id === exclusiveBadgeId))
            throw new NotFoundException();

        await this.prisma.user.update({
            where: { id: session.user.id },
            data: { badges: { connect: { internal_id: exclusiveBadgeId } } }
        });
    }
}
