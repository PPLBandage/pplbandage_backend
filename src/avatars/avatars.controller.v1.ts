import { Controller, Get, Param, StreamableFile, Res } from '@nestjs/common';
import { AvatarsService } from './avatars.service';
import { Response } from 'express';

@Controller({ version: '1', path: 'avatars' })
export class AvatarsController {
    constructor(private readonly avatarsService: AvatarsService) {}

    @Get(':uid')
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

        return new StreamableFile(buff, { type: 'image/png' });
    }

    @Get(':uid/discord')
    async discord(@Param('uid') uid: string) {
        /* Get user' Discord avatar */

        return new StreamableFile(
            await this.avatarsService.getDiscordAvatar(uid),
            { type: 'image/png' }
        );
    }

    @Get(':uid/minecraft')
    async minecraft(@Param('uid') uid: string) {
        /* Get user' Minecraft avatar */

        return new StreamableFile(
            await this.avatarsService.getMinecraftAvatar(uid),
            { type: 'image/png' }
        );
    }

    @Get(':uid/google')
    async google(@Param('uid') uid: string) {
        /* Get user' Google avatar */

        return new StreamableFile(
            await this.avatarsService.getGoogleAvatar(uid),
            { type: 'image/png' }
        );
    }

    @Get(':uid/twitch')
    async twitch(@Param('uid') uid: string) {
        /* Get user' Twitch avatar */

        return new StreamableFile(
            await this.avatarsService.getTwitchAvatar(uid),
            { type: 'image/png' }
        );
    }

    @Get(':uid/telegram')
    async telegram(@Param('uid') uid: string) {
        /* Get user' Telegram avatar */

        return new StreamableFile(
            await this.avatarsService.getTelegramAvatar(uid),
            { type: 'image/png' }
        );
    }
}
