import { Controller, Get, HttpStatus, Param, Req, Res, Delete, Post, UseGuards, Header } from '@nestjs/common';
import type { Request, Response } from 'express'
import { UNAUTHORIZED } from 'src/root/root.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { Auth } from 'src/decorators/auth.decorator';
import { AuthEnum } from 'src/interfaces/types';
import { RequestSession } from 'src/common/bandage_response';

@Controller()
@UseGuards(AuthGuard)
export class AuthController {
    constructor(private readonly authService: AuthService
    ) { }

    @Delete("/user/me")
    async logout(@Req() request: Request, @Res() res: Response): Promise<void> {
        /* log out user */

        const user_agent = request.headers['user-agent'];
        const session = await this.authService.validateSession(request.cookies.sessionId, user_agent as string);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        await this.authService.logout(session);
        res.status(200).send({ "status": "success" });
    }


    @Post("/auth/discord/:code")
    async discord(@Param('code') code: string, @Req() request: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
        /* create session for discord user */

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.authService.login(code, user_agent);

        if (data.statusCode === 200) {
            const date = new Date((new Date()).getTime() + (Number(process.env.SESSION_TTL) * 1000));
            res.setHeader('Access-Control-Expose-Headers', 'SetCookie');
            res.setHeader('SetCookie', `sessionId=${data.sessionId}; Path=/; Expires=${date.toUTCString()}; SameSite=Strict`);
        }
        res.status(data.statusCode).send(data);
    }

    @Get("/auth/roles")
    async roles(@Res() res: Response): Promise<void> {
        /* get roles for registration */

        res.send(await this.authService.getRoles());
    }

    @Get('/user/me/sessions')
    @Auth(AuthEnum.Strict)
    async getSessions(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* get user sessions */

        res.send(await this.authService.getSessions(request.session));
    }

    @Delete("/user/me/sessions/all")
    @Auth(AuthEnum.Strict)
    async delete_all_sessions(
        @Req() request: RequestSession,
        @Res({ passthrough: true }) res: Response
    ) {
        /* log out from all sessions */

        const result = await this.authService.deleteSessionAll(request.session);
        res.status(result.statusCode).send(result);
    }

    @Delete("/user/me/sessions/:id")
    @Auth(AuthEnum.Strict)
    async delete_session(
        @Param('id') id: string,
        @Req() request: RequestSession,
        @Res({ passthrough: true }) res: Response
    ) {
        /* log out from session by id */

        if (isNaN(Number(id))) {
            res.status(400).send({
                statusCode: 400,
                message: 'Invalid session id',
                message_ru: 'Неправильный идентификатор сессии'
            });
            return;
        }

        const result = await this.authService.deleteSession(request.session, Number(id));
        res.status(result.statusCode).send(result);
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