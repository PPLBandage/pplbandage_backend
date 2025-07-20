import { forwardRef, Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { TwitchAuthService } from './twitch.service';

@Module({
    providers: [TwitchAuthService, PrismaService],
    imports: [forwardRef(() => AuthModule)],
    exports: [TwitchAuthService]
})
export class TwitchAuthModule {}

