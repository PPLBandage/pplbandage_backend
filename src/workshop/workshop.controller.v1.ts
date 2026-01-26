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
    HttpCode,
    NotFoundException,
    Header
} from '@nestjs/common';
import { WorkshopService } from './workshop.service';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthGuard } from 'src/guards/auth.guard';
import { AuthEnum, RolesEnum } from 'src/interfaces/types';
import { Auth } from 'src/decorators/auth.decorator';
import { CreateBandageDto } from './dto/createBandage.dto';
import { BandageModerationDto, EditBandageDto } from './dto/editBandage.dto';
import {
    TagQueryDto,
    WorkshopSearchQueryDTO
} from 'src/workshop/dto/queries.dto';
import { SetQueryDTO } from 'src/user/dto/queries.dto';
import { LocalAccessGuard } from 'src/guards/localAccess.guard';
import { generateKey } from 'src/guards/throttlerViews';
import { LocalAccessThrottlerGuard } from 'src/guards/throttlerLocalAccess.guard';
import { Roles } from 'src/decorators/access.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import {
    BandageFull,
    RequestSession,
    RequestSessionWeak
} from 'src/interfaces/interfaces';
import { createReadStream } from 'fs';

@Controller({ path: 'workshop', version: '1' })
@UseGuards(AuthGuard, RolesGuard)
export class WorkshopController {
    constructor(private readonly bandageService: WorkshopService) {}

    @Get()
    @Auth(AuthEnum.Weak)
    async bandages(
        @Req() request: RequestSession,
        @Query() query: WorkshopSearchQueryDTO
    ) {
        /* get list of works */

        return await this.bandageService.getBandages(
            request.session,
            query.take ?? 20,
            query.page ?? 0,
            query.search,
            query.sort
        );
    }

    @Post()
    @HttpCode(201)
    @Auth(AuthEnum.Strict)
    @Throttle({ default: { limit: 1, ttl: 10000 } })
    async create_bandage(
        @Req() request: RequestSession,
        @Body() body: CreateBandageDto
    ) {
        /* create work */

        return await this.bandageService.createBandage(body, request.session);
    }

    @Post(':id/view')
    @UseGuards(new LocalAccessGuard())
    @Throttle({ default: { limit: 1, ttl: 60000, generateKey } })
    async viewBandage(@Param('id') id: string) {
        /* Add bandage view (internal endpoint) */

        await this.bandageService.addView(id);
    }

    @Get(':id/info')
    @SkipThrottle()
    @Auth(AuthEnum.Weak)
    @UseGuards(new LocalAccessGuard())
    async getBandageOg(
        @Param('id') id: string,
        @Req() request: RequestSessionWeak
    ) {
        /* get bandage info by external id (internal endpoint) */

        return await this.bandageService.getDataForOg(id, request.session);
    }

    @Get(':id/og')
    @Auth(AuthEnum.Weak)
    @Header('Cache-Control', 'public, max-age=86400')
    async getBandageImage(
        @Param('id') id: string,
        @Req() request: RequestSessionWeak,
        @Query() query: { token?: string }
    ): Promise<StreamableFile | void> {
        /* get bandage image render (for OpenGraph) */

        const thumbnail = await this.bandageService.getThumbnail(
            id,
            request.session,
            query.token
        );

        if (!thumbnail) throw new NotFoundException();
        return new StreamableFile(
            createReadStream(
                process.env.CACHE_FOLDER + 'thumbnails/' + thumbnail
            ),
            { type: 'image/png' }
        );
    }

    @Put(':id')
    @Auth(AuthEnum.Strict)
    async editBandage(
        @Param('id') id: string,
        @Req() request: RequestSession,
        @Body() body: EditBandageDto
    ) {
        /* edit bandage info */

        await this.bandageService.updateBandage(id, body, request.session);
    }

    @Put(':id/archive')
    @Auth(AuthEnum.Strict)
    async archiveBandage(
        @Param('id') id: string,
        @Req() request: RequestSession
    ) {
        /* Archive bandage */

        await this.bandageService.archiveBandage(request.session, id);
    }

    @Get('moderation')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.ManageBandages])
    async getModeration(@Req() request: RequestSession) {
        /* Get bandages under moderation */
        return await this.bandageService.getModerationWorks(request.session);
    }

    @Get('tags/suggest')
    async suggestTag(@Query() query: TagQueryDto) {
        /* Suggest tags list */
        return await this.bandageService.suggestTag(query.q);
    }

    @Put(':id/moderation')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.ManageBandages])
    async changeBandageModeration(
        @Param('id') id: string,
        @Req() request: RequestSession,
        @Body() body: BandageModerationDto
    ) {
        /* Change bandage moderation status */

        const bandage = await this.bandageService.getBandageById(id);
        await this.bandageService.changeBandageModeration(
            bandage as BandageFull,
            request.session,
            body.type,
            body.message,
            body.is_final,
            body.is_hides
        );
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

    @Put('star/:id')
    @Auth(AuthEnum.Strict)
    async setStar(
        @Param('id') id: string,
        @Query() query: SetQueryDTO,
        @Req() request: RequestSession
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
            color: 'green'
        };
    }

    @Get(':id')
    @Auth(AuthEnum.Weak)
    @UseGuards(LocalAccessThrottlerGuard)
    async getBandage(
        @Param('id') id: string,
        @Req() request: RequestSessionWeak
    ) {
        /* get bandage by external id */

        return await this.bandageService.getBandage(id, request.session);
    }
}
