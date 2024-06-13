import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { UserService } from './user.module';
import { PrismaService } from './prisma.service';
import { BandageService } from './bandage.service';
import { MinecraftService } from './minecraft.service';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

ConfigModule.forRoot();

@Module({
	providers: [{
		provide: APP_GUARD,
		useClass: ThrottlerGuard,
	  },
	  UserService, PrismaService, BandageService, MinecraftService],
	controllers: [AppController],
	imports: [
		ThrottlerModule.forRoot([{
			ttl: 60000,
			limit: 150,
		}])
	]
})
export class AppModule { }
