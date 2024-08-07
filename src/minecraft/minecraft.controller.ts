import { Controller, Get, HttpStatus, Param, Query, Res, StreamableFile, HttpException } from '@nestjs/common';
import type { Response } from 'express'
import { MinecraftService } from 'src/minecraft/minecraft.service';
import { generateSvg } from './svg.module';
import * as sharp from 'sharp';

@Controller('api')
export class minecraftController {
    constructor(private readonly minecraftService: MinecraftService) { }

    @Get("/skin/:name")
    async skin(@Param('name') name: string, @Query() query: { cape: boolean }, @Res({ passthrough: true }) res: Response): Promise<CapeResponse | void> {
        /* get minecraft skin by nickname / UUID */

        const cache = await this.minecraftService.updateSkinCache(name);
        if (!cache) {
            res.status(404).send({ message: 'Profile not found' });
            return;
        }
        if (!query.cape) {
            const skin_buff = Buffer.from(cache.data, "base64");
            res.set({ 'Content-Type': 'image/png', 'Content-Length': skin_buff.length });
            res.end(skin_buff);
            return;
        }
        return {
            data: {
                skin: {
                    data: cache.data,
                    slim: cache.slim
                },
                cape: cache.data_cape
            }
        };
    }

    @Get("/head/:name")
    async head(@Param('name') name: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
        /* get minecraft head by nickname / UUID */

        const cache = await this.minecraftService.updateSkinCache(name);
        if (!cache) {
            throw new HttpException({ message: 'Profile not found' }, HttpStatus.NOT_FOUND);
        }

        res.setHeader('Content-Type', 'image/png');
        return new StreamableFile(Buffer.from(cache.data_head, "base64"));
    }

    @Get("/cape/:name")
    async cape(@Param('name') name: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile | void> {
        /* get minecraft cape by nickname / UUID */

        const cache = await this.minecraftService.updateSkinCache(name);
        if (!cache) {
            res.status(404).send({ message: 'Profile not found' });
            return;
        }
        if (!cache.data_cape) {
            res.status(404).send({ message: 'No cape on this profile' });
            return;
        }
        const skin_buff = Buffer.from(cache.data_cape, "base64");
        res.setHeader('Content-Type', 'image/png');
        return new StreamableFile(skin_buff);
    }


    @Get("/search/:name")
    async search(@Param('name') name: string, @Query() query: SearchQuery): Promise<Search> {
        /* search nicknames by requested fragment */

        const cache = await this.minecraftService.searchNicks({ fragment: name, take: parseInt(query.take as string) || 20, page: parseInt(query.page as string) || 0 });
        if (!cache) {
            throw new HttpException({ message: 'No content' }, HttpStatus.NO_CONTENT);
        }
        return cache;
    }

    @Get('/beta/head/:name')
    async beta_head(@Param('name') name: string, @Res({ passthrough: true }) res: Response, @Query() query: { pixel_width: number }) {
        const pixel_width = Number(query.pixel_width) || 50;

        const cache = await this.minecraftService.updateSkinCache(name);
        if (!cache) {
            throw new HttpException({ message: 'Profile not found' }, HttpStatus.NOT_FOUND);
        }
        const result = await generateSvg(sharp(Buffer.from(cache.data, "base64")), pixel_width);
        res.set({ 'Content-Type': 'image/svg+xml' });
        return result;
    }
}