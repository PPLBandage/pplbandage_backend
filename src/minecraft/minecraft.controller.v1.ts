import { Controller, Get, Param, Query, StreamableFile, ValidationPipe, UsePipes, Header } from '@nestjs/common';
import { MinecraftService } from 'src/minecraft/minecraft.service';
import * as sharp from 'sharp';
import { PageTakeQueryDTO } from 'src/user/dto/queries.dto';
import { PixelWidthQueryDTO } from './dto/queries.dto';
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
            skin: cache.data,
            cape: cache.data_cape,
            slim: cache.slim
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
    @Header('Content-Type', 'image/svg+xml')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async headSVG(
        @Param('name') name: string,
        @Query() query: PixelWidthQueryDTO
    ): Promise<string> {
        /* Generate SVG head */

        const cache = await this.minecraftService.updateSkinCache(name);
        return await this.minecraftService.generateSvg(
            sharp(Buffer.from(cache.data, "base64")),
            query.pixel_width ?? 50
        );
    }
}