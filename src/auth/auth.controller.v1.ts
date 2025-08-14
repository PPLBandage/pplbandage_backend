import {
    Controller,
    Get,
    Req,
    Res,
    Post,
    UseGuards,
    Query,
    Body,
    UsePipes,
    ValidationPipe
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { generateCookie } from './auth.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { DiscordAuthService } from './providers/discord/discord.service';
import { MinecraftAuthService } from './providers/minecraft/minecraft.service';
import { GoogleAuthService } from './providers/google/google.service';
import { TwitchAuthService } from './providers/twitch/twitch.service';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses from 'src/localization/common.localization';
import { CodeDTO } from './dto/code.dto';
import { TelegramAuthService } from './providers/telegram/telegram.service';

@Controller({ version: '1', path: 'auth' })
@UseGuards(AuthGuard)
export class AuthController {
    constructor(
        private readonly discordAuthService: DiscordAuthService,
        private readonly minecraftAuthService: MinecraftAuthService,
        private readonly googleAuthService: GoogleAuthService,
        private readonly twitchAuthService: TwitchAuthService,
        private readonly telegramAuthService: TelegramAuthService
    ) {}

    @Post('discord')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async discord(
        @Req() request: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body: CodeDTO
    ) {
        /* create session for discord user */

        if (!body.code) throw new LocaleException(responses.INVALID_BODY, 400);

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.discordAuthService.login(body.code, user_agent);

        const expires =
            Math.round(Date.now() / 1000) + Number(process.env.SESSION_TTL);
        res.setHeader('SetCookie', generateCookie(data.sessionId, expires));

        return { session: data.sessionId };
    }

    @Post('minecraft')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async minecraftLogin(
        @Req() request: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body: CodeDTO
    ) {
        /* create session for minecraft user */

        if (!body.code) throw new LocaleException(responses.INVALID_BODY, 400);

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.minecraftAuthService.login(
            body.code,
            user_agent
        );

        const expires =
            Math.round(Date.now() / 1000) + Number(process.env.SESSION_TTL);
        res.setHeader('SetCookie', generateCookie(data.sessionId, expires));

        return { session: data.sessionId };
    }

    @Post('google')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async googleLogin(
        @Req() request: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body: CodeDTO
    ) {
        /* create session for google user */

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.googleAuthService.login(body.code, user_agent);

        const expires =
            Math.round(Date.now() / 1000) + Number(process.env.SESSION_TTL);
        res.setHeader('SetCookie', generateCookie(data.sessionId, expires));

        return { session: data.sessionId };
    }

    @Post('twitch')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async twitchLogin(
        @Req() request: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body: CodeDTO
    ) {
        /* create session for twitch user */

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.twitchAuthService.login(body.code, user_agent);

        const expires =
            Math.round(Date.now() / 1000) + Number(process.env.SESSION_TTL);
        res.setHeader('SetCookie', generateCookie(data.sessionId, expires));

        return { session: data.sessionId };
    }

    @Post('telegram')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async telegramLogin(
        @Req() request: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body: CodeDTO
    ) {
        /* create session for telegram user */

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.telegramAuthService.login(
            body.code,
            user_agent
        );

        const expires =
            Math.round(Date.now() / 1000) + Number(process.env.SESSION_TTL);
        res.setHeader('SetCookie', generateCookie(data.sessionId, expires));

        return { session: data.sessionId };
    }

    @Get('url/discord')
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

    @Get('url/google')
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

    @Get('url/twitch')
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

    @Get('url/telegram')
    async urlTelegram(
        @Res() res: Response,
        @Query() query: { connect: boolean }
    ): Promise<void> {
        /* get telegram oauth url */

        const login_url = new URL(process.env.TELEGRAM_API_URL as string);
        login_url.searchParams.append('bot_id', process.env.TELEGRAM_BOT_ID!);
        login_url.searchParams.append('origin', process.env.DOMAIN!);

        const redirect_path = query.connect
            ? '/me/accounts/connect/telegram'
            : '/me/login/telegram';
        login_url.searchParams.append(
            'return_to',
            `${process.env.DOMAIN}/${redirect_path}`
        );
        res.redirect(login_url.toString());
    }
}
