import { Module } from '@nestjs/common';
import { RootController } from './root.controller.v1';
import { RootService } from './root.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
    controllers: [RootController],
    providers: [RootService, PrismaService]
})
export class RootModule {}
