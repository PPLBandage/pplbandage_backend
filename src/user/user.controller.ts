import { Controller, Get, HttpStatus, Param, Query, Req, Res, Delete, Put, Post, Body, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express'
import { AuthGuard } from 'src/guards/auth.guard';
import { UserService } from './user.module';
import { NotificationService } from 'src/notifications/notifications.service';
import { MinecraftService } from 'src/minecraft/minecraft.service';
import { Throttle } from '@nestjs/throttler';
import { BandageService } from 'src/workshop/bandage.service';
import { RequestSession } from 'src/app.service';
import { RolesGuard } from 'src/guards/roles.guard';
import { AuthEnum, RolesEnum } from 'src/interfaces/types';
import { Auth } from 'src/decorators/auth.decorator';
import { Roles } from 'src/decorators/access.decorator';

@Controller('api')
@UseGuards(AuthGuard, RolesGuard)
export class UserController {
    constructor(private readonly userService: UserService,
        private readonly notificationService: NotificationService,
        private readonly minecraftService: MinecraftService,
        private readonly bandageService: BandageService
    ) { }

    @Get("/user/me")
    @Auth(AuthEnum.Strict)
    async me_profile(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* get user data. associated with session */

        const data = await this.userService.getUser(request.session);
        res.status(data.statusCode).send(data);
    }

    @Get("/user/me/works")
    @Auth(AuthEnum.Strict)
    async getWork(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* get user's works */

        const data = await this.userService.getWork(request.session);
        res.status(data.statusCode).send(data.data);
    }

    @Get("/user/me/stars")
    @Auth(AuthEnum.Strict)
    async getStars(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* get user's stars */

        const data = await this.userService.getStars(request.session);
        res.status(data.statusCode).send(data.data);
    }

    @Get("/user/me/settings")
    @Auth(AuthEnum.Strict)
    async minecraft(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* get user's settings */

        const data = await this.userService.getUserSettings(request.session);
        res.status(data.statusCode).send(data);
    }

    @Get("/user/me/notifications")
    @Auth(AuthEnum.Strict)
    async getNotifications(@Req() request: RequestSession, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        /* get user's connections */

        const data = await this.notificationService.get(request.session, parseInt(query.take as string) || 5, parseInt(query.page as string) || 0);
        res.send(data);
    }

    @Put("/user/me/profile_theme")
    @Auth(AuthEnum.Strict)
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
        res.status(200).send({
            status: 'success',
            new_theme: theme
        })
    }

    @Put("/user/me/connections/minecraft/set_valid")
    @Auth(AuthEnum.Strict)
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
    @Auth(AuthEnum.Strict)
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
    @Auth(AuthEnum.Strict)
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
    @Auth(AuthEnum.Strict)
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
    @Auth(AuthEnum.Strict)
    async disconnectMinecraft(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* disconnect minecraft profile */
        const data = await this.minecraftService.disconnect(request.session);
        res.status(data.statusCode).send(data);
    }

    @Get("/users/:username")
    @Auth(AuthEnum.Weak)
    async user_profile(@Param('username') username: string, @Req() request: RequestSession, @Res() res: Response): Promise<void> {
        /* get user data by nickname */

        const data = await this.userService.getUserByNickname(username, request.session);
        res.status(data.statusCode).send(data);
    }


    @Put("/star/:id")
    @Auth(AuthEnum.Strict)
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
    @Auth(AuthEnum.Strict)
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

    @Get('/users')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    async get_users(@Res() res: Response) {
        res.status(200).send(await this.userService.getUsers());
    }
}