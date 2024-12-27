import { Controller, Get, HttpStatus, Param, Query, Res, StreamableFile, HttpException, ValidationPipe, UsePipes, Header } from '@nestjs/common';
import type { Response } from 'express';
import { MinecraftService } from 'src/minecraft/minecraft.service';
import * as sharp from 'sharp';
import { PageTakeQueryDTO } from 'src/user/dto/queries.dto';
import { CapeQueryDTO, PixelWidthQueryDTO } from './dto/queries.dto';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses from 'src/localization/minecraft.localization';

@Controller({ path: 'minecraft', version: '1' })
export class MinecraftController {
    constructor(private readonly minecraftService: MinecraftService) { }

    @Get("/skin/:name")
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async skin(@Param('name') name: string) {
        /* get minecraft skin by nickname / UUID */

        const cache = await this.minecraftService.updateSkinCache(name);
        return {
            data: {
                skin: { data: cache.data, slim: cache.slim },
                cape: cache.data_cape
            }
        };
    }

    @Get("/head/:name")
    @Header('Content-Type', 'image/png')
    async head(@Param('name') name: string): Promise<StreamableFile> {
        /* get minecraft head by nickname / UUID */

        const cache = await this.minecraftService.updateSkinCache(name);
        return new StreamableFile(Buffer.from(cache.data_head, "base64"));
    }

    @Get("/cape/:name")
    @Header('Content-Type', 'image/png')
    async cape(@Param('name') name: string): Promise<StreamableFile | void> {
        /* get minecraft cape by nickname / UUID */

        const cache = await this.minecraftService.updateSkinCache(name);
        if (!cache.data_cape)
            throw new LocaleException(responses.CAPE_NOT_FOUND, 404);

        return new StreamableFile(Buffer.from(cache.data_cape, "base64"));
    }


    @Get("/search/:name")
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async search(
        @Param('name') name: string,
        @Query() query: PageTakeQueryDTO
    ) {
        /* search nicknames by requested fragment */

        return await this.minecraftService.searchNicks({
            fragment: name,
            take: query.take ?? 20,
            page: query.page ?? 0
        });
    }

    @Get('/head/:name/svg')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async beta_head(
        @Param('name') name: string,
        @Res({ passthrough: true }) res: Response,
        @Query() query: PixelWidthQueryDTO
    ): Promise<string> {
        /* Generate SVG head */

        const pixel_width = query.pixel_width ?? 50;

        const cache = await this.minecraftService.updateSkinCache(name);
        if (!cache) {
            throw new HttpException({
                statusCode: 404,
                message: 'Profile not found',
                message_ru: 'Профиль не найден'
            }, HttpStatus.NOT_FOUND);
        }
        const result = await this.minecraftService.generateSvg(sharp(Buffer.from(cache.data, "base64")), pixel_width);
        res.set({ 'Content-Type': 'image/svg+xml' });
        return result;
    }
}