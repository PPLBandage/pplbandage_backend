import { Module } from '@nestjs/common';
import { ThumbnailsService } from './thumbnails.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    providers: [ThumbnailsService],
    imports: [AuthModule],
    exports: [ThumbnailsService]
})
export class ThumbnailsModule {}
