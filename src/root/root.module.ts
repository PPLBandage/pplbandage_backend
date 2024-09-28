import { Module } from '@nestjs/common';
import { RootController } from './root.controller';
import { ConfigModule } from '@nestjs/config';
import { UserService } from 'src/user/user.service';
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
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { DiscordNotificationService } from 'src/notifications/discord.service';
import { CacheModule } from '@nestjs/cache-manager';

ConfigModule.forRoot();

@Module({
	providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard },
		UserService,
		PrismaService,
		BandageService,
		MinecraftService,
		AuthService,
		AuthGuard,
		NotificationService,
		DiscordNotificationService
	],
	controllers: [RootController, WorkshopController, UserController, minecraftController, AuthController],
	imports: [
		ThrottlerModule.forRoot([{
			ttl: 60000,
			limit: 150,
		}]),
		CacheModule.register()
	]
})
export class RootModule { }
