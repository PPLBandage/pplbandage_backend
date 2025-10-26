import { Module } from '@nestjs/common';
import { KvController } from './kv.controller.v1';
import { AuthModule } from 'src/auth/auth.module';
import { KVDataBase } from 'src/prisma/kv.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsModule } from 'src/workshop/events/events.module';
import { EventsController } from './events.controller.v1';

@Module({
    controllers: [KvController, EventsController],
    providers: [KVDataBase, PrismaService],
    imports: [AuthModule, EventsModule]
})
export class AdminModule {}
