import { Controller, Get, HttpStatus, Param, Req, Res, Delete, Post } from '@nestjs/common';
import type { Request, Response } from 'express'
import { UNAUTHORIZED } from 'src/root/root.controller';
import { OauthService } from './oauth.module';

@Controller('api')
export class OauthController {
    constructor(private readonly oauthService: OauthService
    ) { }

    @Delete("/user/me")
    async logout(@Req() request: Request, @Res() res: Response): Promise<void> {
        /* log out user */

        const user_agent = request.headers['user-agent'];
        const session = await this.oauthService.validateSession(request.cookies.sessionId, user_agent as string);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        await this.oauthService.logout(session);
        res.status(200).send({ "status": "success" });
    }


    @Post("/oauth/discord/:code")
    async discord(@Param('code') code: string, @Req() request: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
        /* create session for discord user */

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.oauthService.login(code, user_agent);
        if (!data) {
            res.status(500).send({ status: "error", message: "could not login" });
            return;
        }
        if (data.statusCode !== 200) {
            res.status(data.statusCode).send(data);
            return;
        }

        const date = new Date((new Date()).getTime() + (Number(process.env.SESSION_TTL) * 1000));
        res.setHeader('Access-Control-Expose-Headers', 'SetCookie');
        res.setHeader('SetCookie', `sessionId=${data.sessionId}; Path=/; Expires=${date.toUTCString()}; SameSite=Strict`);

        res.send(data);
    }

    @Get("/oauth/roles")
    async roles(@Res() res: Response): Promise<void> {
        /* get roles for registration */

        res.send(await this.oauthService.getRoles());
    }
}