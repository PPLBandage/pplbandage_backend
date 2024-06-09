import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { PrismaService } from './prisma.service';
import { NestExpressApplication } from '@nestjs/platform-express';

const pr = new PrismaService();
async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	const allowedOrigins = ['http://localhost:3000', 'http://localhost:8081', 'https://pplbandage.ru', 'http://192.168.0.53'];

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
	app.useBodyParser('json', { limit: '10mb' });
	app.use(cookieParser());
	await app.listen(8082);
}
bootstrap();
