import {
    Controller,
    Get,
    Param,
    Query,
    Req,
    StreamableFile,
    Delete,
    Put,
    Post,
    Body,
    UseGuards,
    ValidationPipe,
    UsePipes,
    HttpCode,
    Header,
} from '@nestjs/common';
import type { Request } from 'express';
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
import responses_common from 'src/localization/common.localization';
import { LocaleException } from 'src/interceptors/localization.interceptor';

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
        @Query() query: WorkshopSearchQueryDTO,
    ) {
        /* get list of works */

        return await this.bandageService.getBandages(
            request.session,
            query.take ?? 20,
            query.page ?? 0,
            query.search,
            query.filters,
            query.sort,
        );
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post()
    @Auth(AuthEnum.Strict)
    @HttpCode(201)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async create_bandage(
        @Req() request: RequestSession,
        @Body() body: CreateBandageDto,
    ) {
        /* create work */

        const validate_result = await this.bandageService.validateBandage(body.base64);

        if (body.split_type) {
            if (!body.base64_slim) {
                throw new LocaleException(responses_common.INVALID_BODY, 400);
            }

            await this.bandageService.validateBandage(
                body.base64_slim,
                validate_result.height as number,
            );
        }

        return await this.bandageService.createBandage(body, request.session);
    }

    @Post(':id/view')
    @SkipThrottle()
    async viewBandage(
        @Param('id') id: string,
        @Req() request: Request,
    ) {
        /* Add bandage view (internal endpoint) */

        if (request.headers['unique-access'] !== process.env.WORKSHOP_TOKEN) {
            throw new LocaleException(responses_common.FORBIDDEN, 403);
        }
        await this.bandageService.addView(id);
    }

    @Get(':id/info')
    @SkipThrottle()
    @Auth(AuthEnum.Weak)
    async getBandageOg(
        @Param('id') id: string,
        @Req() request: RequestSession
    ) {
        /* get bandage info by external id (internal endpoint) */

        if (request.headers['unique-access'] !== process.env.WORKSHOP_TOKEN) {
            throw new LocaleException(responses_common.FORBIDDEN, 403);
        }
        return await this.bandageService.getDataForOg(id, request.session);
    }

    @Get(':id/og')
    @Auth(AuthEnum.Weak)
    @Header('Content-Type', 'image/png')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async getBandageImage(
        @Param('id') id: string,
        @Req() request: RequestSession,
        @Query() query: WidthQueryDTO,
    ): Promise<StreamableFile | void> {
        /* get bandage image render (for OpenGraph) */

        const requested_width = query.width ?? 512;

        const data = await this.bandageService.getBandage(id, request.session);

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

        return new StreamableFile(await bandage.toBuffer());
    }

    @Put(':id')
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async editBandage(
        @Param('id') id: string,
        @Req() request: RequestSession,
        @Body() body: EditBandageDto,
    ) {
        /* edit bandage info */

        if (!body) {
            throw new LocaleException(responses_common.INVALID_BODY, 400);
        }

        return await this.bandageService.updateBandage(
            id,
            body,
            request.session,
        );
    }

    @Put(':id/archive')
    @Auth(AuthEnum.Strict)
    async archiveBandage(
        @Param('id') id: string,
        @Req() request: RequestSession,
    ) {
        /* Archive bandage */

        await this.bandageService.archiveBandage(request.session, id);
    }

    @Delete(':id')
    @Auth(AuthEnum.Strict)
    async deleteBandage(
        @Param('id') id: string,
        @Req() request: RequestSession
    ) {
        /* delete bandage by external id */

        await this.bandageService.deleteBandage(request.session, id);
    }

    @Get('categories')
    @Auth(AuthEnum.Weak)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async categories(
        @Req() request: RequestSession,
        @Query() query: EditQueryDTO,
    ) {
        /* get list of categories */

        return await this.bandageService.getCategories(
            query.for_edit === 'true',
            request.session,
        );
    }

    @Put('star/:id')
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async setStar(
        @Param('id') id: string,
        @Query() query: SetQueryDTO,
        @Req() request: RequestSession,
    ) {
        /* set star to work by work external id */

        return await this.bandageService.setStar(
            request.session,
            query.set === 'true',
            id
        );
    }

    @Get('count/badge')
    async getCount() {
        const count = await this.bandageService.getBandagesCount();
        return {
            schemaVersion: 1,
            label: 'Bandages Count',
            message: count.toString(),
            color: 'green',
        };
    }

    @Get(':id')
    @SkipThrottle()
    @Auth(AuthEnum.Weak)
    async getBandage(
        @Param('id') id: string,
        @Req() request: RequestSession
    ) {
        /* get bandage by external id (internal endpoint) */

        if (request.headers['unique-access'] !== process.env.WORKSHOP_TOKEN) {
            throw new LocaleException(responses_common.FORBIDDEN, 403);
        }
        return await this.bandageService.getBandage(id, request.session);
    }
}
