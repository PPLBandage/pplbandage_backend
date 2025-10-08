import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.v1';
import { AuthModule } from 'src/auth/auth.module';
import { KVDataBase } from 'src/prisma/kv.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
    controllers: [AdminController],
    providers: [KVDataBase, PrismaService],
    imports: [AuthModule]
})
export class AdminModule {}
