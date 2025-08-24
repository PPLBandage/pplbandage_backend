import {
    Controller,
    Get,
    UsePipes,
    Query,
    ValidationPipe,
    HttpException,
    StreamableFile
} from '@nestjs/common';
import { EmotesService } from './emotes.service';
import { QueryDto } from './dto/queries.dto';

@Controller({ version: '1', path: 'emote' })
export class EmotesController {
    constructor(private readonly emotesService: EmotesService) {}
    ttl: number = 1000 * 60 * 60 * 24;

    @Get()
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async getEmote(@Query() query: QueryDto) {
        if (!query.q)
            throw new HttpException('Query parameter `q` must be set', 400);

        const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;
        const isUlid = ulidRegex.test(query.q);

        const id = isUlid
            ? query.q
            : (await this.emotesService.searchEmote(query.q)).id;

        return new StreamableFile(
            Buffer.from(await this.emotesService.getEmote(id), 'base64'),
            { type: 'image/webp' }
        );
    }
}
