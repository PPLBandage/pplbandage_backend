import { Controller, Get, Param, Req, Res, Delete, Post, UseGuards, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express'
import { AuthService, generateCookie } from './auth.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { Auth } from 'src/decorators/auth.decorator';
import { AuthEnum } from 'src/interfaces/types';
import { RequestSession } from 'src/common/bandage_response';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses from 'src/localization/common.localization';

@Controller({ version: '1' })
@UseGuards(AuthGuard)
export class AuthController {
    constructor(private readonly authService: AuthService
    ) { }

    @Delete("/user/me")
    async logout(@Req() request: Request): Promise<void> {
        /* log out user */

        const user_agent = request.headers['user-agent'];
        const session = await this.authService.validateSession(request.cookies.sessionId, user_agent as string, true);
        if (!session)
            throw new LocaleException(responses.UNAUTHORIZED, 401);

        await this.authService.logout(session);
    }


    @Post("/auth/discord/:code")
    async discord(
        @Param('code') code: string,
        @Req() request: Request,
        @Res({ passthrough: true }) res: Response
    ) {
        /* create session for discord user */

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.authService.login(code, user_agent);

        const expires = Math.round(Date.now() / 1000) + Number(process.env.SESSION_TTL);
        res.setHeader('SetCookie', generateCookie(data.sessionId as string, expires));

        return data;
    }

    @Get("/auth/roles")
    async roles() {
        /* get roles for registration */

        return await this.authService.getRoles();
    }

    @Get('/user/me/sessions')
    @Auth(AuthEnum.Strict)
    async getSessions(@Req() request: RequestSession) {
        /* get user sessions */

        return await this.authService.getSessions(request.session);
    }

    @Delete("/user/me/sessions/all")
    @Auth(AuthEnum.Strict)
    async delete_all_sessions(@Req() request: RequestSession) {
        /* log out from all sessions */

        await this.authService.deleteSessionAll(request.session);
    }

    @Delete("/user/me/sessions/:id")
    @Auth(AuthEnum.Strict)
    async delete_session(
        @Param('id') id: string,
        @Req() request: RequestSession
    ) {
        /* log out from session by id */

        if (isNaN(Number(id)))
            throw new HttpException('Invalid session id', 400);

        await this.authService.deleteSession(request.session, Number(id));
    }

    @Get("/auth/url")
    async url(
        @Req() req: Request,
        @Res() res: Response
    ): Promise<void> {
        /* get discord oauth url */

        if (req.header('Accept')?.toLowerCase() === 'application/json') {
            res.header('Content-Type', 'application/json');
            res.send({ url: process.env.LOGIN_URL });
            return;
        }
        res.redirect(process.env.LOGIN_URL as string);
    }
}