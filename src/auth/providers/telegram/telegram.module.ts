import { forwardRef, Module } from '@nestjs/common';
import { TelegramAuthService } from './telegram.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    providers: [TelegramAuthService, PrismaService],
    imports: [forwardRef(() => AuthModule)],
    exports: [TelegramAuthService]
})
export class TelegramAuthModule {}
