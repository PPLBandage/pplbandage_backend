import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { GoogleAuthService } from './google.service';

@Module({
    providers: [GoogleAuthService],
    imports: [forwardRef(() => AuthModule)],
    exports: [GoogleAuthService]
})
export class GoogleAuthModule {}
