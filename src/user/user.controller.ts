import { Controller, Get, HttpStatus, Param, Query, Req, Res, Delete, Put, Post, Body, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express'
import { AuthGuard } from 'src/guards/auth.guard';
import { UserService } from './user.module';
import { UNAUTHORIZED } from 'src/root/root.controller';
import { NotificationService } from 'src/notifications/notifications.service';
import { MinecraftService } from 'src/minecraft/minecraft.service';
import { Throttle } from '@nestjs/throttler';
import { BandageService } from 'src/workshop/bandage.service';

@Controller('api')
export class UserController {
    constructor(private readonly userService: UserService,
        private readonly notificationService: NotificationService,
        private readonly minecraftService: MinecraftService,
        private readonly bandageService: BandageService
    ) { }

    @Get("/user/me")
    @UseGuards(AuthGuard)
    async me_profile(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* get user data. associated with session */

        const data = await this.userService.getUser(request.session.sessionId);
        res.status(data.statusCode).send(data);
    }

    @Delete("/user/me")
    async logout(@Req() request: Request, @Res() res: Response): Promise<void> {
        /* log out user */

        const user_agent = request.headers['user-agent'];
        const session = await this.userService.validateSession(request.cookies.sessionId, user_agent as string);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        await this.userService.logout(session);
        res.status(200).send({ "status": "success" });
    }


    @Get("/user/me/works")
    @UseGuards(AuthGuard)
    async getWork(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* get user's works */

        const data = await this.userService.getWork(request.session);
        res.status(data.statusCode).send(data.data);
    }

    @Get("/user/me/stars")
    @UseGuards(AuthGuard)
    async getStars(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* get user's stars */

        const data = await this.userService.getStars(request.session);
        res.status(data.statusCode).send(data.data);
    }

    @Get("/user/me/settings")
    @UseGuards(AuthGuard)
    async minecraft(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* get user's connections */

        const data = await this.userService.getUserSettings(request.session);
        res.status(data.statusCode).send(data);
    }

    @Get("/user/me/notifications")
    @UseGuards(AuthGuard)
    async getNotifications(@Req() request: RequestSession, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        /* get user's connections */

        const data = await this.notificationService.get(request.session, parseInt(query.take as string) || 5, parseInt(query.page as string) || 0);
        res.send(data);
    }

    @Post("/user/me/profile_theme")
    @UseGuards(AuthGuard)
    async profile_theme(@Req() request: RequestSession, @Res() res: Response, @Body() body: { theme: string }): Promise<void> {
        /* update profile theme */

        const theme = Number(body.theme);
        if (isNaN(theme) || theme < 0 || theme > 2) {
            res.status(400).send({
                status: 'error',
                message: 'invalid profile theme'
            })
        }

        await this.userService.setProfileTheme(request.session, theme);
        res.status(201).send({
            status: 'success',
            new_theme: theme
        })
    }

    @Put("/user/me/connections/minecraft/set_valid")
    @UseGuards(AuthGuard)
    async set_valid(@Req() request: RequestSession, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        /* set displaying nickname in search */

        if (!query.state || !["true", "false"].includes(query.state)) {
            res.status(HttpStatus.BAD_REQUEST).send({
                status: "error",
                message: "`state` query param invalid",
                statusCode: 400
            });
            return;
        }
        const data = await this.minecraftService.changeValid(request.session, query.state === "true");
        res.status(data.statusCode).send(data);
    }

    @Put("/user/me/connections/minecraft/set_autoload")
    @UseGuards(AuthGuard)
    async set_autoload(@Req() request: RequestSession, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        /* set skin autoload in editor */

        if (!query.state || !["true", "false"].includes(query.state)) {
            res.status(HttpStatus.BAD_REQUEST).send({
                status: "error",
                message: "`State` query param invalid",
                statusCode: 400
            });
            return;
        }
        const data = await this.userService.changeAutoload(request.session, query.state === "true");
        res.status(data.statusCode).send(data);
    }

    @Post("/user/me/connections/minecraft/connect/:code")
    @UseGuards(AuthGuard)
    async connectMinecraft(@Param('code') code: string, @Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* connect minecraft profile to account */

        if (code.length != 6) {
            res.status(HttpStatus.BAD_REQUEST).send({
                status: "error",
                message: "Invalid code",
                message_ru: "Код должен содержать 6 символов!"
            });
            return;
        }

        const data = await this.minecraftService.connect(request.session, code);
        res.status(data.statusCode).send(data);
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post("/user/me/connections/minecraft/cache/purge")
    @UseGuards(AuthGuard)
    async skinPurge(@Req() request: RequestSession, @Res({ passthrough: true }) res: Response): Promise<void> {
        /* purge minecraft skin cache, associated with session's account */

        if (!request.session.user.profile) {
            res.status(400).send({
                message: "Could not find associated Minecraft account",
            });
            return;
        }

        const cache = await this.minecraftService.updateSkinCache(request.session.user.profile.uuid, true);
        if (!cache) {
            res.status(404).send({
                message: 'Profile not found'
            });
            return;
        }

        res.status(200).send({
            message: "Successfully purged",
        });
    }

    @Delete("/user/me/connections/minecraft")
    @UseGuards(AuthGuard)
    async disconnectMinecraft(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* disconnect minecraft profile */
        const data = await this.minecraftService.disconnect(request.session);
        res.status(data.statusCode).send(data);
    }

    @Get("/users/:username")
    async user_profile(@Param('username') username: string, @Req() request: Request, @Res() res: Response): Promise<void> {
        /* get user data by nickname */

        const session = await this.userService.validateSession(request.cookies.sessionId, request.headers['user-agent'] as string);
        const data = await this.userService.getUserByNickname(username, session);
        res.status(data.statusCode).send(data);
    }

    @Post("/oauth/discord/:code")
    async discord(@Param('code') code: string, @Req() request: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
        /* create session for discord user */

        const user_agent = request.headers['user-agent'] as string;
        const data = await this.userService.login(code, user_agent);
        if (!data) {
            res.status(400).send({ status: "error", message: "could not login" });
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
    async roles(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* get roles for registration */

        res.send(await this.userService.getRoles());
    }

    @Put("/star/:id")
    @UseGuards(AuthGuard)
    async setStar(@Param('id') id: string, @Query() query: { set: string }, @Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* set star to work by work external id */

        if (!query.set || !["true", "false"].includes(query.set)) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "`Set` query param invalid",
                statusCode: 400
            });
            return;
        }
        const data = await this.bandageService.setStar(request.session, query.set === "true", id);
        res.status(data.statusCode).send(data);
    }

    @Put("/user/me/settings/set_public")
    @UseGuards(AuthGuard)
    async set_public(@Req() request: RequestSession, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        /* set skin autoload in editor */

        if (!query.state || !["true", "false"].includes(query.state)) {
            res.status(HttpStatus.BAD_REQUEST).send({
                status: "error",
                message: "`State` query param invalid",
                statusCode: 400
            });
            return;
        }
        const data = await this.userService.setPublic(request.session, query.state === "true");
        res.status(data.statusCode).send(data);
    }
}