import { forwardRef, Module } from '@nestjs/common';
import { TelegramAuthService } from './telegram.service';
import { AuthModule } from 'src/auth/auth.module';
import { ProxyModule } from 'src/proxy/proxy.module';

@Module({
    providers: [TelegramAuthService],
    imports: [forwardRef(() => AuthModule), ProxyModule],
    exports: [TelegramAuthService]
})
export class TelegramAuthModule {}
