import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { UserService } from './user.module';
import { PrismaService } from './prisma.service';
import { BandageService } from './bandage.service';
import { MinecraftService } from './minecraft.service';

ConfigModule.forRoot();

@Module({
	providers: [UserService, PrismaService, BandageService, MinecraftService],
	controllers: [AppController],
})
export class AppModule { }
