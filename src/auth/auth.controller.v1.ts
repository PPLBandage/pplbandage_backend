import {
    Controller,
    Get,
    Param,
    Req,
    Res,
    Post,
    UseGuards,
    Query
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, generateCookie } from './auth.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { DiscordAuthService } from './providers/discord/discord.service';
import { MinecraftAuthService } from './providers/minecraft/minecraft.service';

@Controller({ version: '1', path: 'auth' })
@UseGuards(AuthGuard)
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly discordAuthService: DiscordAuthService,
        private readonly minecraftAuthService: MinecraftAuthService
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

    // DEPRECATED: Will be removed in future versions
    @Get('/roles')
    async roles() {
        /* get roles for registration */

        return await this.authService.getRoles();
    }

    @Get('/url/discord')
    async url(
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
}

