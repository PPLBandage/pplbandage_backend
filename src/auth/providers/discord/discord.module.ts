import { forwardRef, Module } from '@nestjs/common';
import { DiscordAuthService } from './discord.service';
import { AuthModule } from 'src/auth/auth.module';
import { ProxyModule } from 'src/proxy/proxy.module';

@Module({
    providers: [DiscordAuthService],
    imports: [forwardRef(() => AuthModule), ProxyModule],
    exports: [DiscordAuthService]
})
export class DiscordAuthModule {}
