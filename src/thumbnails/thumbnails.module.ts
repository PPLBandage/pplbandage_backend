import { Module } from '@nestjs/common';
import { ThumbnailsController } from './thumbnails.controller.v1';
import { ThumbnailsService } from './thumbnails.service';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
    controllers: [ThumbnailsController],
    providers: [ThumbnailsService, PrismaService],
    imports: [AuthModule]
})
export class ThumbnailsModule {}
