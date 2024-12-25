import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.v1';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
    controllers: [AuthController],
    providers: [AuthService, PrismaService, UserService],
    imports: [CacheModule.register()]
})
export class AuthModule { }