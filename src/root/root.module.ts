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

ConfigModule.forRoot();

@Module({
	providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard },
		UserService,
		PrismaService,
		BandageService,
		MinecraftService,
		AuthGuard,
		NotificationService],
	controllers: [RootController, WorkshopController, UserController, minecraftController],
	imports: [
		ThrottlerModule.forRoot([{
			ttl: 60000,
			limit: 150,
		}])
	]
})
export class RootModule { }
