import { Module } from '@nestjs/common';
import { AvatarsController } from './avatars.controller.v1';
import { AvatarsService } from './avatars.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
    controllers: [AvatarsController],
    providers: [AvatarsService, PrismaService]
})
export class AvatarsModule {}

