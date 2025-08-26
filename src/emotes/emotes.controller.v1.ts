import {
    Controller,
    Get,
    UsePipes,
    Query,
    ValidationPipe,
    StreamableFile,
    Header
} from '@nestjs/common';
import { EmotesService } from './emotes.service';
import { QueryDto } from './dto/queries.dto';

@Controller({ version: '1', path: 'emote' })
export class EmotesController {
    constructor(private readonly emotesService: EmotesService) {}
    ttl: number = 1000 * 60 * 60 * 24;

    @Get()
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    @Header('Cache-Control', 'public, max-age=86400, immutable')
    async getEmote(@Query() query: QueryDto) {
        const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;
        const isUlid = ulidRegex.test(query.q.toUpperCase());

        const id = isUlid
            ? query.q
            : (await this.emotesService.searchEmote(query.q.toUpperCase())).id;

        return new StreamableFile(
            Buffer.from(await this.emotesService.getEmote(id), 'base64'),
            { type: 'image/webp' }
        );
    }
}
