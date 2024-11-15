import { NestFactory } from '@nestjs/core';
import { RootModule } from './root/root.module';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as morgan from 'morgan';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(RootModule);
	const allowedOrigins = ['https://pplbandage.ru', 'http://192.168.0.53', 'https://dev.andcool.ru', 'http://localhost:3000'];

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
	app.setGlobalPrefix('api/v1');
	app.use(cookieParser());
	await app.listen(8001);
}
bootstrap();
