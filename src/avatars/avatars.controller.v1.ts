import {
    Controller,
    Get,
    Param,
    Header,
    StreamableFile,
    Res
} from '@nestjs/common';
import { AvatarsService } from './avatars.service';
import { Response } from 'express';

@Controller({ version: '1', path: 'avatars' })
export class AvatarsController {
    constructor(private readonly avatarsService: AvatarsService) {}

    @Get(':uid')
    @Header('Content-Type', 'image/png')
    async mainAvatar(
        @Param('uid') uid: string,
        @Res({ passthrough: true }) res: Response
    ) {
        /* Get user' main (preferred) avatar */

        const buff = await this.avatarsService.getPreferredAvatar(uid);
        if (!buff) {
            res.redirect(307, '/icon.png');
            return;
        }

        return new StreamableFile(buff);
    }

    @Get(':uid/discord')
    @Header('Content-Type', 'image/png')
    async discord(@Param('uid') uid: string) {
        /* Get user' Discord avatar */

        return new StreamableFile(
            await this.avatarsService.getDiscordAvatar(uid)
        );
    }

    @Get(':uid/minecraft')
    @Header('Content-Type', 'image/png')
    async minecraft(@Param('uid') uid: string) {
        /* Get user' Minecraft avatar */

        return new StreamableFile(
            await this.avatarsService.getMinecraftAvatar(uid)
        );
    }

    @Get(':uid/google')
    @Header('Content-Type', 'image/png')
    async google(@Param('uid') uid: string) {
        /* Get user' Google avatar */

        return new StreamableFile(
            await this.avatarsService.getGoogleAvatar(uid)
        );
    }
}

