import {
    Controller,
    Get,
    Param,
    Req,
    Res,
    Post,
    UseGuards,
    Query,
    Body
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, generateCookie } from './auth.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { DiscordAuthService } from './providers/discord/discord.service';
import { MinecraftAuthService } from './providers/minecraft/minecraft.service';
import { GoogleAuthService } from './providers/google/google.service';
import { TwitchAuthService } from './providers/twitch/twitch.service';

@Controller({ version: '1', path: 'auth' })
@UseGuards(AuthGuard)
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly discordAuthService: DiscordAuthService,
        private readonly minecraftAuthService: MinecraftAuthService,
        private readonly googleAuthService: GoogleAuthService,
        private readonly twitchAuthService: TwitchAuthService
    ) {}

    @Post('/discord/:code')
    async discord(
        @Param('code') code: string,
        @Req() request: Request,
        @Res({ passthrough: true }) res: Response
    ) {
        /* create session for discord user */

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.discordAuthService.login(code, user_agent);

        const expires =
            Math.round(Date.now() / 1000) + Number(process.env.SESSION_TTL);
        res.setHeader('SetCookie', generateCookie(data.sessionId, expires));

        return data;
    }

    @Post('/minecraft/:code')
    async minecraftLogin(
        @Param('code') code: string,
        @Req() request: Request,
        @Res({ passthrough: true }) res: Response
    ) {
        /* create session for minecraft user */

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.minecraftAuthService.login(code, user_agent);

        const expires =
            Math.round(Date.now() / 1000) + Number(process.env.SESSION_TTL);
        res.setHeader('SetCookie', generateCookie(data.sessionId, expires));

        return data;
    }

    @Post('/google')
    async googleLogin(
        @Req() request: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body: { code: string }
    ) {
        /* create session for google user */

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.googleAuthService.login(body.code, user_agent);

        const expires =
            Math.round(Date.now() / 1000) + Number(process.env.SESSION_TTL);
        res.setHeader('SetCookie', generateCookie(data.sessionId, expires));

        return data;
    }

    @Post('/twitch')
    async twitchLogin(
        @Req() request: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body: { code: string }
    ) {
        /* create session for twitch user */

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.twitchAuthService.login(body.code, user_agent);

        const expires =
            Math.round(Date.now() / 1000) + Number(process.env.SESSION_TTL);
        res.setHeader('SetCookie', generateCookie(data.sessionId, expires));

        return data;
    }

    @Get('/url/discord')
    async urlDiscord(
        @Res() res: Response,
        @Query() query: { connect: boolean }
    ): Promise<void> {
        /* get discord oauth url */

        const login_url = new URL(process.env.DISCORD_LOGIN_URL as string);

        if (query.connect) {
            login_url.searchParams.append(
                'redirect_uri',
                process.env.DISCORD_REDIRECT_CONNECT as string
            );
        } else {
            login_url.searchParams.append(
                'redirect_uri',
                process.env.DISCORD_MAIN_REDIRECT as string
            );
        }
        res.redirect(login_url.toString());
    }

    @Get('/url/google')
    async urlGoogle(
        @Res() res: Response,
        @Query() query: { connect: boolean }
    ): Promise<void> {
        /* get google oauth url */

        const login_url = new URL(process.env.GOOGLE_LOGIN_URL as string);
        login_url.searchParams.append(
            'client_id',
            process.env.GOOGLE_CLIENT_ID as string
        );

        if (query.connect) {
            login_url.searchParams.append(
                'redirect_uri',
                process.env.GOOGLE_REDIRECT_CONNECT as string
            );
        } else {
            login_url.searchParams.append(
                'redirect_uri',
                process.env.GOOGLE_MAIN_REDIRECT as string
            );
        }
        res.redirect(login_url.toString());
    }

    @Get('/url/twitch')
    async urlTwitch(
        @Res() res: Response,
        @Query() query: { connect: boolean }
    ): Promise<void> {
        /* get twitch oauth url */

        const login_url = new URL(process.env.TWITCH_LOGIN_URL as string);
        login_url.searchParams.append(
            'client_id',
            process.env.TWITCH_CLIENT_ID as string
        );

        if (query.connect) {
            login_url.searchParams.append(
                'redirect_uri',
                process.env.TWITCH_REDIRECT_CONNECT as string
            );
        } else {
            login_url.searchParams.append(
                'redirect_uri',
                process.env.TWITCH_MAIN_REDIRECT as string
            );
        }
        res.redirect(login_url.toString());
    }
}

