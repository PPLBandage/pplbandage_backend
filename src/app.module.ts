import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { UserService } from './user.module';
import { PrismaService } from './prisma.service';

ConfigModule.forRoot();

@Module({
	providers: [UserService, PrismaService],
	controllers: [AppController],
})
export class AppModule { }
