import { forwardRef, Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { GoogleAuthService } from './google.service';

@Module({
    providers: [GoogleAuthService, PrismaService],
    imports: [forwardRef(() => AuthModule)],
    exports: [GoogleAuthService]
})
export class GoogleAuthModule {}

