import {
    Controller,
    Get,
    HttpStatus,
    Param,
    Query,
    Req,
    Res,
    StreamableFile,
    Delete,
    Put,
    Post,
    Body,
    UseGuards,
    ValidationPipe,
    UsePipes,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { WorkshopService } from './workshop.service';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthGuard } from 'src/guards/auth.guard';
import * as sharp from 'sharp';
import { AuthEnum } from 'src/interfaces/types';
import { Auth } from 'src/decorators/auth.decorator';
import { CreateBandageDto } from './dto/createBandage.dto';
import { EditBandageDto } from './dto/editBandage.dto';
import { RequestSession } from 'src/common/bandage_response';
import {
    EditQueryDTO,
    WidthQueryDTO,
    WorkshopSearchQueryDTO,
} from 'src/workshop/dto/queries.dto';
import { SetQueryDTO } from 'src/user/dto/queries.dto';

@Controller({ path: 'workshop', version: '1' })
@UseGuards(AuthGuard)
export class WorkshopController {
    constructor(
        private readonly bandageService: WorkshopService
    ) { }
    @Get()
    @Auth(AuthEnum.Weak)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async bandages(
        @Req() request: RequestSession,
        @Res() res: Response,
        @Query() query: WorkshopSearchQueryDTO,
    ): Promise<void> {
        /* get list of works */

        res
            .status(200)
            .send(
                await this.bandageService.getBandages(
                    request.session,
                    query.take ?? 20,
                    query.page ?? 0,
                    query.search,
                    query.filters,
                    query.sort,
                ),
            );
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post()
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async create_bandage(
        @Req() request: RequestSession,
        @Res() res: Response,
        @Body() body: CreateBandageDto,
    ): Promise<void> {
        /* create work */

        if (!body.base64 || !body.title) {
            res.status(HttpStatus.BAD_REQUEST).send({
                statusCode: 400,
                message: 'Invalid Body',
                message_ru: 'Неправильное тело запроса',
            });
            return;
        }

        const validate_result = await this.bandageService.validateBandage(
            body.base64,
        );
        if (validate_result.statusCode !== 200) {
            res.status(validate_result.statusCode).send(validate_result);
            return;
        }

        if (body.split_type === true) {
            if (!body.base64_slim) {
                res.status(400).send({
                    statusCode: 400,
                    message: 'Invalid Body',
                    message_ru: 'Неправильное тело запроса',
                });
                return;
            }

            const validate_result_slim = await this.bandageService.validateBandage(
                body.base64_slim,
                validate_result.height as number,
            );
            if (validate_result.statusCode !== 200) {
                res.status(validate_result_slim.statusCode).send(validate_result_slim);
                return;
            }
        }

        const data = await this.bandageService.createBandage(body, request.session);
        res.status(data.statusCode).send(data);
    }

    @Post(':id/view')
    @SkipThrottle()
    async viewBandage(
        @Param('id') id: string,
        @Req() request: Request,
        @Res() res: Response,
    ): Promise<void> {
        /* Add bandage view (internal endpoint) */

        if (request.headers['unique-access'] !== process.env.WORKSHOP_TOKEN) {
            res.status(403).send({
                statusCode: 403,
                message: 'Forbidden',
                message_ru: 'Доступ запрещен',
            });
            return;
        }
        const data = await this.bandageService.addView(id);
        res.status(data.statusCode).send(data);
    }

    @Get(':id/info')
    @SkipThrottle()
    @Auth(AuthEnum.Weak)
    async getBandageOg(
        @Param('id') id: string,
        @Req() request: RequestSession,
        @Res() res: Response,
    ): Promise<void> {
        /* get bandage info by external id (internal endpoint) */

        if (request.headers['unique-access'] !== process.env.WORKSHOP_TOKEN) {
            res.status(403).send({
                statusCode: 403,
                message: 'Forbidden',
                message_ru: 'Доступ запрещен',
            });
            return;
        }
        const data = await this.bandageService.getDataForOg(id, request.session);
        res.status(data.statusCode).send(data);
    }

    @Get('/workshop/:id/og')
    @Auth(AuthEnum.Weak)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async getBandageImage(
        @Param('id') id: string,
        @Req() request: RequestSession,
        @Res({ passthrough: true }) res: Response,
        @Query() query: WidthQueryDTO,
    ): Promise<StreamableFile | void> {
        /* get bandage image render (for OpenGraph) */

        const requested_width = query.width ?? 512;

        const data = await this.bandageService.getBandage(id, request.session);
        if (data.statusCode !== 200 || !data.data?.base64) {
            res.status(data.statusCode).send(data);
            return;
        }
        const bandage_buff = Buffer.from(data.data.base64, 'base64');
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
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
        }).png();

        const firstLayer = await sharp(bandage_buff)
            .extract({
                left: 0,
                top: original_height / 2,
                width: original_width,
                height: original_height / 2,
            })
            .resize(width, height / 2, { kernel: sharp.kernel.nearest })
            .png()
            .toBuffer();

        const secondLayer = await sharp(bandage_buff)
            .extract({
                left: 0,
                top: 0,
                width: original_width,
                height: original_height / 2,
            })
            .resize(width, height / 2, { kernel: sharp.kernel.nearest })
            .png()
            .toBuffer();

        bandage.composite([
            { input: firstLayer, top: 0, left: 0, blend: 'over' },
            { input: secondLayer, top: 0, left: 0, blend: 'over' },
        ]);

        res.setHeader('Content-Type', 'image/png');
        return new StreamableFile(await bandage.toBuffer());
    }

    @Put(':id')
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async editBandage(
        @Param('id') id: string,
        @Req() request: RequestSession,
        @Res() res: Response,
        @Body() body: EditBandageDto,
    ) {
        /* edit bandage info */

        if (!body) {
            res.status(HttpStatus.BAD_REQUEST).send({
                statusCode: 400,
                message: 'Invalid Body',
                message_ru: 'Неправильное тело запроса',
            });
            return;
        }

        const data = await this.bandageService.updateBandage(
            id,
            body,
            request.session,
        );
        res.status(data.statusCode).send(data);
    }

    @Put(':id/archive')
    @Auth(AuthEnum.Strict)
    async archiveBandage(
        @Param('id') id: string,
        @Req() request: RequestSession,
        @Res() res: Response,
    ) {
        /* Archive bandage */

        const data = await this.bandageService.archiveBandage(request.session, id);
        res.status(data.statusCode).send(data);
    }

    @Delete(':id')
    @Auth(AuthEnum.Strict)
    async deleteBandage(
        @Param('id') id: string,
        @Req() request: RequestSession,
        @Res() res: Response,
    ) {
        /* delete bandage by external id */

        const data = await this.bandageService.deleteBandage(request.session, id);
        res.status(data.statusCode).send(data);
    }

    @Get('categories')
    @Auth(AuthEnum.Weak)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async categories(
        @Req() request: RequestSession,
        @Res() res: Response,
        @Query() query: EditQueryDTO,
    ): Promise<void> {
        /* get list of categories */

        res.status(200).send(
            await this.bandageService.getCategories(
                query.for_edit === 'true',
                request.session,
            ),
        );
    }

    @Put('star/:id')
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async setStar(
        @Param('id') id: string,
        @Query() query: SetQueryDTO,
        @Req() request: RequestSession,
        @Res() res: Response,
    ): Promise<void> {
        /* set star to work by work external id */

        const data = await this.bandageService.setStar(
            request.session,
            query.set === 'true',
            id,
        );
        res.status(data.statusCode).send(data);
    }

    @Get('count/badge')
    async getCount(@Res() res: Response) {
        const count = await this.bandageService.getBandagesCount();
        res.status(200).send({
            schemaVersion: 1,
            label: 'Bandages Count',
            message: count.toString(),
            color: 'green',
        });
    }

    @Get(':id')
    @SkipThrottle()
    @Auth(AuthEnum.Weak)
    async getBandage(
        @Param('id') id: string,
        @Req() request: RequestSession,
        @Res() res: Response,
    ): Promise<void> {
        /* get bandage by external id (internal endpoint) */

        if (request.headers['unique-access'] !== process.env.WORKSHOP_TOKEN) {
            res.status(403).send({
                statusCode: 403,
                message: 'Forbidden',
                message_ru: 'Доступ запрещен',
            });
            return;
        }
        const data = await this.bandageService.getBandage(id, request.session);
        res.status(data.statusCode).send(data);
    }
}
