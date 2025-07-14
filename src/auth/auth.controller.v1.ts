import {
    Controller,
    Get,
    Param,
    Req,
    Res,
    Post,
    UseGuards
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, generateCookie } from './auth.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { DiscordAuthService } from './providers/discord/discord.service';

@Controller({ version: '1', path: 'auth' })
@UseGuards(AuthGuard)
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly discordAuthService: DiscordAuthService
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
        res.setHeader(
            'SetCookie',
            generateCookie(data.sessionId as string, expires)
        );

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
        const data = await this.authService.loginMinecraft(code, user_agent);

        const expires =
            Math.round(Date.now() / 1000) + Number(process.env.SESSION_TTL);
        res.setHeader(
            'SetCookie',
            generateCookie(data.sessionId as string, expires)
        );

        return data;
    }

    @Get('/roles')
    async roles() {
        /* get roles for registration */

        return await this.authService.getRoles();
    }

    @Get('/url')
    async url(@Req() req: Request, @Res() res: Response): Promise<void> {
        /* get discord oauth url */

        if (req.header('Accept')?.toLowerCase() === 'application/json') {
            res.header('Content-Type', 'application/json');
            res.send({ url: process.env.LOGIN_URL });
            return;
        }
        res.redirect(process.env.LOGIN_URL as string);
    }
}

