import { forwardRef, Module } from '@nestjs/common';
import { DiscordAuthService } from './discord.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    providers: [DiscordAuthService, PrismaService],
    imports: [forwardRef(() => AuthModule)],
    exports: [DiscordAuthService]
})
export class DiscordAuthModule {}

