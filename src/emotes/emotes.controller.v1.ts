import {
    Controller,
    Get,
    UsePipes,
    Query,
    ValidationPipe,
    HttpException,
    StreamableFile
} from '@nestjs/common';
import { TagQueryDto } from 'src/workshop/dto/queries.dto';
import { EmotesService } from './emotes.service';

@Controller({ version: '1', path: 'emote' })
export class EmotesController {
    constructor(private readonly emotesService: EmotesService) {}
    ttl: number = 1000 * 60 * 60 * 24;

    @Get()
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async getEmote(@Query() query: TagQueryDto) {
        if (!query.q)
            throw new HttpException('Query parameter `q` must be set', 400);

        return new StreamableFile(
            Buffer.from(await this.emotesService.getEmote(query.q), 'base64'),
            { type: 'image/webp' }
        );
    }
}
