import { forwardRef, Module } from '@nestjs/common';
import { DiscordAuthService } from './discord.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    providers: [DiscordAuthService],
    imports: [forwardRef(() => AuthModule)],
    exports: [DiscordAuthService]
})
export class DiscordAuthModule {}
