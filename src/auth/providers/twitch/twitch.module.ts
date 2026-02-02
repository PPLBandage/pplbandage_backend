import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { TwitchAuthService } from './twitch.service';

@Module({
    providers: [TwitchAuthService],
    imports: [forwardRef(() => AuthModule)],
    exports: [TwitchAuthService]
})
export class TwitchAuthModule {}
