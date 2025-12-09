import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { KVDataBase } from 'src/prisma/kv.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TempController } from './temp.controller.v1';
import { TempService } from './temp.service';

@Module({
    controllers: [TempController],
    providers: [KVDataBase, PrismaService, TempService],
    imports: [AuthModule]
})
export class TempModule {}
