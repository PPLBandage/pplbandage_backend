import { Module } from '@nestjs/common';
import { RootController } from './root.controller';
import { ConfigModule } from '@nestjs/config';
import { UserService } from 'src/user/user.module';
import { PrismaService } from '../prisma/prisma.service';
import { BandageService } from 'src/workshop/bandage.service';
import { MinecraftService } from '../minecraft/minecraft.service';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '../guards/auth.guard';
import { NotificationService } from '../notifications/notifications.service';
import { WorkshopController } from 'src/workshop/workshop.controller';
import { UserController } from 'src/user/user.controller';
import { minecraftController } from 'src/minecraft/minecraft.controller';
import { OauthController } from 'src/oauth/oauth.controller';
import { OauthService } from 'src/oauth/oauth.module';

ConfigModule.forRoot();

@Module({
	providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard },
		UserService,
		PrismaService,
		BandageService,
		MinecraftService,
		OauthService,
		AuthGuard,
		NotificationService],
	controllers: [RootController, WorkshopController, UserController, minecraftController, OauthController],
	imports: [
		ThrottlerModule.forRoot([{
			ttl: 60000,
			limit: 150,
		}])
	]
})
export class RootModule { }
