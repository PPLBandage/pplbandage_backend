import { forwardRef, Module } from '@nestjs/common';
import { TelegramAuthService } from './telegram.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    providers: [TelegramAuthService],
    imports: [forwardRef(() => AuthModule)],
    exports: [TelegramAuthService]
})
export class TelegramAuthModule {}
