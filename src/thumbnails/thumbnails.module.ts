import { Module } from '@nestjs/common';
import { ThumbnailsService } from './thumbnails.service';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
    providers: [ThumbnailsService, PrismaService],
    imports: [AuthModule],
    exports: [ThumbnailsService]
})
export class ThumbnailsModule {}
