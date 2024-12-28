import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as morgan from 'morgan';
import { AppModule } from './app.module';
import { VersioningType } from '@nestjs/common';
import { LocaleInterceptor } from './interceptors/localization.interceptor';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	const allowedOrigins: string[] = JSON.parse((process.env.CORS_DOMAINS as string).replaceAll(`'`, `"`));

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
	app.setGlobalPrefix('api');
	app.useGlobalInterceptors(new LocaleInterceptor());

	app.enableVersioning({ type: VersioningType.URI });

	app.use(cookieParser());
	await app.listen(8001);
}
bootstrap();
