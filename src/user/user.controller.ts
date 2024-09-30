import {
    Controller,
    Get,
    HttpStatus,
    Param,
    Query,
    Req,
    Res,
    Delete,
    Put,
    Post,
    Body,
    UseGuards,
    ValidationPipe,
    UsePipes
} from '@nestjs/common';
import type { Response } from 'express'
import { AuthGuard } from 'src/guards/auth.guard';
import { UserService } from './user.service';
import { NotificationService } from 'src/notifications/notifications.service';
import { MinecraftService } from 'src/minecraft/minecraft.service';
import { Throttle } from '@nestjs/throttler';
import { RolesGuard } from 'src/guards/roles.guard';
import { AuthEnum, RolesEnum } from 'src/interfaces/types';
import { Auth } from 'src/decorators/auth.decorator';
import { Roles } from 'src/decorators/access.decorator';
import { UpdateUsersDto } from './dto/updateUser.dto';
import { RequestSession } from 'src/common/bandage_response';
import { PageTakeQueryDTO, StateQueryDTO, ThemeQueryDTO } from './dto/queries.dto';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class UserController {
    constructor(private readonly userService: UserService,
        private readonly notificationService: NotificationService,
        private readonly minecraftService: MinecraftService
    ) { }

    @Get("/user/me")
    @Auth(AuthEnum.Strict)
    async me_profile(
        @Req() request: RequestSession,
        @Res() res: Response
    ): Promise<void> {
        /* get user data. associated with session */

        const data = await this.userService.getUser(request.session);
        res.status(data.statusCode).send(data);
    }

    @Get("/user/me/works")
    @Auth(AuthEnum.Strict)
    async getWork(
        @Req() request: RequestSession,
        @Res() res: Response
    ): Promise<void> {
        /* get user's works */

        const data = await this.userService.getWork(request.session);
        res.status(data.statusCode).send(data.data);
    }

    @Get("/user/me/stars")
    @Auth(AuthEnum.Strict)
    async getStars(
        @Req() request: RequestSession,
        @Res() res: Response
    ): Promise<void> {
        /* get user's stars */

        const data = await this.userService.getStars(request.session);
        res.status(data.statusCode).send(data.data);
    }

    @Get("/user/me/settings")
    @Auth(AuthEnum.Strict)
    async minecraft(
        @Req() request: RequestSession,
        @Res() res: Response
    ): Promise<void> {
        /* get user's settings */

        const data = await this.userService.getUserSettings(request.session);
        res.status(data.statusCode).send(data);
    }

    @Get("/user/me/notifications")
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async getNotifications(
        @Req() request: RequestSession,
        @Res() res: Response,
        @Query() query: PageTakeQueryDTO
    ): Promise<void> {
        /* get user's connections */

        const data = await this.notificationService.get(request.session, query.take || 5, query.page || 0);
        res.send(data);
    }

    @Put("/user/me/profile_theme")
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async profile_theme(
        @Req() request: RequestSession,
        @Res() res: Response,
        @Body() body: ThemeQueryDTO
    ): Promise<void> {
        /* update profile theme */

        await this.userService.setProfileTheme(request.session, body.theme as number);
        res.status(200).send({
            status: 'success',
            new_theme: body.theme
        })
    }

    @Put("/user/me/connections/minecraft/set_valid")
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async set_valid(
        @Req() request: RequestSession,
        @Res() res: Response,
        @Query() query: StateQueryDTO
    ): Promise<void> {
        /* set displaying nickname in search */

        const data = await this.minecraftService.changeValid(request.session, query.state === 'true');
        res.status(data.statusCode).send(data);
    }

    @Put("/user/me/connections/minecraft/set_autoload")
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async set_autoload(
        @Req() request: RequestSession,
        @Res() res: Response,
        @Query() query: StateQueryDTO
    ): Promise<void> {
        /* set skin autoload in editor */

        const data = await this.userService.changeAutoload(request.session, query.state === 'true');
        res.status(data.statusCode).send(data);
    }

    @Post("/user/me/connections/minecraft/connect/:code")
    @Auth(AuthEnum.Strict)
    async connectMinecraft(
        @Param('code') code: string,
        @Req() request: RequestSession,
        @Res() res: Response
    ): Promise<void> {
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
    async skinPurge(
        @Req() request: RequestSession,
        @Res({ passthrough: true }) res: Response
    ): Promise<void> {
        /* purge minecraft skin cache, associated with session's account */

        if (!request.session.user.profile) {
            res.status(404).send({
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
    async disconnectMinecraft(
        @Req() request: RequestSession,
        @Res() res: Response
    ): Promise<void> {
        /* disconnect minecraft profile */
        const data = await this.minecraftService.disconnect(request.session);
        res.status(data.statusCode).send(data);
    }

    @Get("/users/:username")
    @Auth(AuthEnum.Weak)
    async user_profile(
        @Param('username') username: string,
        @Req() request: RequestSession,
        @Res() res: Response
    ): Promise<void> {
        /* get user data by nickname */

        const data = await this.userService.getUserByNickname(username, request.session);
        res.status(data.statusCode).send(data);
    }

    @Get("/users/:username/og")
    async userOg(
        @Param('username') username: string,
        @Res() res: Response
    ): Promise<void> {
        /* get user data by nickname */

        const data = await this.userService.getUserOg(username);
        res.status(data.statusCode).send(data);
    }

    @Put("/user/me/settings/set_public")
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async set_public(
        @Req() request: RequestSession,
        @Res() res: Response,
        @Query() query: StateQueryDTO
    ): Promise<void> {
        /* set skin autoload in editor */

        const data = await this.userService.setPublic(request.session, query.state === 'true');
        res.status(data.statusCode).send(data);
    }

    @Get('/users')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    async get_users(@Res() res: Response) {
        res.status(200).send(await this.userService.getUsers());
    }

    @Put('/users/:username')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async update_user(@Param('username') username: string, @Res() res: Response, @Body() body: UpdateUsersDto) {
        const data = await this.userService.updateUser(username, body);
        res.status(data.statusCode).send(data);
    }
}