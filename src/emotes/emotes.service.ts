import { HttpException, Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import axios from 'axios';
import { GQLResponse } from './types';

@Injectable()
export class EmotesService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}
    ttl: number = 1000 * 60 * 60 * 24;

    async searchEmote(
        q: string
    ): Promise<NonNullable<GQLResponse['data']>['emotes']['items'][0]> {
        const cache = await this.cacheManager.get(`emote-search-${q}`);
        if (cache && cache !== '404') return JSON.parse(cache as string);

        const search_result = await axios.post('https://7tv.io/v3/gql', {
            query: `
                query ($query: String!) {
                    emotes(query: $query, limit: 1, filter: { exact_match: true }) {
                        items {
                            id
                            name
                            host {
                                url
                        }
                    }
                }
            }`,
            variables: { query: q }
        });

        if (search_result.status !== 200)
            throw new HttpException(
                'Cannot get emote info',
                search_result.status
            );

        const data = search_result.data as GQLResponse;
        if (!data.data || data.data.emotes.items.length === 0) {
            await this.cacheManager.set(`emote-search-${q}`, '404', this.ttl);
            throw new HttpException(`Emote \`${q}\` not found`, 404);
        }

        await this.cacheManager.set(
            `emote-search-${q}`,
            JSON.stringify(data.data.emotes.items.at(0)),
            this.ttl
        );

        return data.data.emotes.items.at(0)!;
    }

    async getEmote(id: string): Promise<string> {
        const cache_key = `emote-${id}`;
        const cache: string | null | undefined =
            await this.cacheManager.get(cache_key);
        if (cache && cache !== '404') return cache;

        const image = await axios.get(
            `https://cdn.7tv.app/emote/${id}/1x.webp`,
            {
                responseType: 'arraybuffer'
            }
        );

        if (image.status !== 200) {
            await this.cacheManager.set(cache_key, '404', this.ttl);
            throw new HttpException('Cannot fetch emote image', image.status);
        }

        const base64 = Buffer.from(image.data, 'binary').toString('base64');
        await this.cacheManager.set(cache_key, base64, this.ttl);

        return base64;
    }
}
