import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';

ConfigModule.forRoot();

@Module({
	controllers: [AppController],
})
export class AppModule { }
