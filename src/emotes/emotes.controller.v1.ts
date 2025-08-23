import {
    Controller,
    Get,
    UsePipes,
    Query,
    ValidationPipe,
    HttpException,
    Res,
    Inject
} from '@nestjs/common';
import axios from 'axios';
import { TagQueryDto } from 'src/workshop/dto/queries.dto';
import { GQLResponse } from './types';
import { Response } from 'express';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Controller({ version: '1', path: 'emotes' })
export class EmotesController {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}
    ttl: number = 1000 * 60 * 60 * 24;

    @Get('search')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async getEmote(@Query() query: TagQueryDto, @Res() res: Response) {
        if (!query.q)
            throw new HttpException('Query parameter `q` must be set', 400);

        const cache_key = `emote-${query.q}`;
        let cache = await this.cacheManager.get(cache_key);
        if (cache === '404')
            throw new HttpException(`Emote \`${query.q}\` not found`, 404);

        if (!cache) {
            const search_result = await axios.post('https://7tv.io/v3/gql', {
                query: `
                query ($query: String!) {
                    emotes(query: $query, limit: 1, filter: {exact_match: true}) {
                        items {
                        id
                        name
                        host {
                            url
                        }
                    }
                }
            }`,
                variables: { query: query.q }
            });

            const data = search_result.data as GQLResponse;
            if (data.data.emotes.items.length === 0) {
                await this.cacheManager.set(cache_key, '404', this.ttl);
                throw new HttpException(`Emote \`${query.q}\` not found`, 404);
            }

            cache = data.data.emotes.items.at(0)!.host.url;
            await this.cacheManager.set(cache_key, cache, this.ttl);
        }

        res.redirect(`https:${cache}/1x.webp`);
    }
}
