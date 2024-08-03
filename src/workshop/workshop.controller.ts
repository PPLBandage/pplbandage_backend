import { Controller, Get, HttpStatus, Param, Query, Req, Res, StreamableFile, Delete, Put, Post, Body, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express'
import { BandageService } from "./bandage.service";
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthGuard } from 'src/guards/auth.guard';
import * as sharp from 'sharp';

@Controller('api')
export class WorkshopController {
    constructor(private readonly bandageService: BandageService) { }
    @Get("/workshop")
    async bandages(@Req() request: Request, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        /* get list of works */

        const user_agent = request.headers['user-agent'] as string;
        res.status(200).send(await this.bandageService.getBandages(request.cookies.sessionId,
            parseInt(query.take as string) || 20,
            parseInt(query.page as string) || 0,
            user_agent,
            query.search,
            query.filters,
            query.sort));
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post("/workshop")
    @UseGuards(AuthGuard)
    async create_bandage(@Req() request: RequestSession, @Res() res: Response, @Body() body: CreateBody): Promise<void> {
        /* create work */

        if (!body.base64 || !body.title) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Invalid Body",
                statusCode: 400
            });
            return;
        }

        if (body.title.length > 50) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Title cannot be longer than 50 symbols",
                message_ru: "Заголовок не может быть длиннее 50 символов",
                statusCode: 400
            });
            return;
        }

        if (body.description.length > 300) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Description cannot be longer than 300 symbols",
                message_ru: "Описание не может быть длиннее 300 символов",
                statusCode: 400
            });
            return;
        }

        const validate_result = await this.bandageService.validateBandage(body.base64);
        if (validate_result.statusCode !== 200) {
            res.status(validate_result.statusCode).send(validate_result.data);
            return;
        }

        if (body.split_type === true) {
            if (!body.base64_slim) {
                res.status(400).send({
                    message: "Invalid Body",
                    statusCode: 400
                });
                return;
            }

            const validate_result_slim = await this.bandageService.validateBandage(body.base64_slim, validate_result.data.height as number);
            if (validate_result.statusCode !== 200) {
                res.status(validate_result_slim.statusCode).send(validate_result_slim.data);
                return;
            }
        }

        const data = await this.bandageService.createBandage(body, request.session);
        res.status(data.statusCode).send(data);
    }

    @Get("/workshop/:id")
    @SkipThrottle()
    async getBandage(@Param('id') id: string, @Req() request: Request, @Res() res: Response): Promise<void> {
        /* get bandage by external id (internal endpoint) */

        if (request.headers['unique-access'] !== process.env.WORKSHOP_TOKEN) {
            res.status(403).send({ message: 'Forbidden', statusCode: 403 });
            return;
        }
        const user_agent = request.headers['user-agent'] as string;
        const data = await this.bandageService.getBandage(id, request.cookies.sessionId, user_agent);
        res.status(data.statusCode).send(data);
    }

    @Get(["/workshop/:id/as_image", "/workshop/:id/og"])
    async getBandageImage(@Param('id') id: string, @Req() request: Request, @Res({ passthrough: true }) res: Response, @Query() query: { width: number }): Promise<StreamableFile | void> {
        /* get bandage image render (for OpenGraph) */

        const requested_width = Number(query.width) || 512;
        if (isNaN(requested_width) || requested_width < 16 || requested_width > 1000) {
            res.status(400).send({
                status: 'error',
                message: '`width` cannot be less than 16 an higher than 1000'
            });
            return;
        }

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.bandageService.getBandage(id, request.cookies.sessionId, user_agent);
        if (data.statusCode !== 200 || !data.data?.base64) {
            res.status(data.statusCode).send(data);
            return;
        }
        const bandage_buff = Buffer.from(data.data.base64, "base64");

        const metadata = await sharp(bandage_buff).metadata();

        const original_width = metadata.width as number;
        const original_height = metadata.height as number;

        const factor = requested_width / original_width;
        const width = original_width * factor;
        const height = original_height * factor;

        const bandage = sharp({
            create: {
                width: width,
                height: height / 2,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        }).png();

        const firstLayer = await sharp(bandage_buff)
            .extract({ left: 0, top: (original_height / 2), width: original_width, height: original_height / 2 })
            .resize(width, height / 2, { kernel: sharp.kernel.nearest })
            .png()
            .toBuffer();

        const secondLayer = await sharp(bandage_buff)
            .extract({ left: 0, top: 0, width: original_width, height: original_height / 2 })
            .resize(width, height / 2, { kernel: sharp.kernel.nearest })
            .png()
            .toBuffer();

        bandage.composite([
            { input: firstLayer, top: 0, left: 0, blend: 'over' },
            { input: secondLayer, top: 0, left: 0, blend: 'over' }
        ]);

        res.setHeader('Content-Type', 'image/png');
        return new StreamableFile(await bandage.toBuffer());
    }

    @Put("/workshop/:id")
    @UseGuards(AuthGuard)
    async editBandage(@Param('id') id: string, @Req() request: RequestSession, @Res() res: Response, @Body() body: CreateBody) {
        /* edit bandage info */

        if (!body) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Invalid Body",
                statusCode: 400
            });
            return;
        }

        if (body.title?.length > 50) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Title cannot be longer than 50 symbols",
                statusCode: 400
            });
            return;
        }

        if (body.description?.length > 300) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Description cannot be longer than 300 symbols",
                statusCode: 400
            });
            return;
        }

        const data = await this.bandageService.updateBandage(id, body, request.session);
        res.status(data.statusCode).send(data);

    }

    @Delete("/workshop/:id")
    @UseGuards(AuthGuard)
    async deleteBandage(@Param('id') id: string, @Req() request: RequestSession, @Res() res: Response) {
        /* delete bandage by external id */

        const data = await this.bandageService.deleteBandage(request.session, id);
        res.status(data.statusCode).send(data);

    }

    @Get("/categories")
    async categories(@Req() request: Request, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        /* get list of categories */

        const user_agent = request.headers['user-agent'] as string;
        res.status(200).send(await this.bandageService.getCategories(query.for_edit === "true", request.cookies.sessionId, user_agent));
    }

    @Get('/workshop/count/badge')
    async getCount(@Res() res: Response) {
        const count = await this.bandageService.getBandagesCount();
        res.status(200).send({
            "schemaVersion": 1,
            "label": 'Bandages Count',
            "message": count.toString(),
            "color": 'green'
        });
    }
}