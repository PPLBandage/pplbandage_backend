import { Module } from '@nestjs/common';
import { RootController } from './root.controller.v1';
import { RootService } from './root.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
    controllers: [RootController],
    providers: [RootService, PrismaService],
    imports: [CacheModule.register()]
})
export class RootModule {}
