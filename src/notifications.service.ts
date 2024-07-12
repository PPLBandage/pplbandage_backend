import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UserService } from './user.module';

@Injectable()
export class NotificationService {
    constructor(private prisma: PrismaService,
        private users: UserService,
    ) {}
}
