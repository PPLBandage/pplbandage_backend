import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as morgan from 'morgan';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	const allowedOrigins = ['https://pplbandage.ru', 'http://192.168.0.53', 'https://dev.andcool.ru'];

	app.enableCors({
		origin: (origin, callback) => {
			if (!origin || allowedOrigins.indexOf(origin) !== -1) {
				callback(null, true);
			} else {
				callback(new Error('Not allowed by CORS'));
			}
		},
		credentials: true,
	});
	app.use(morgan(':method :url :status - :response-time ms'));
	app.useBodyParser('json', { limit: '10mb' });
	app.use(cookieParser());
	await app.listen(8082);
}
bootstrap();
