import {
    Controller,
    Get,
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
    UsePipes,
    StreamableFile,
    Patch,
    HttpException
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
import { ForceRegisterUserDTO, UpdateSelfUserDto, UpdateUsersDto } from './dto/updateUser.dto';
import { RequestSession } from 'src/common/bandage_response';
import { PageTakeQueryDTO, QueryDTO } from './dto/queries.dto';

@Controller({ version: '1' })
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

    @Post("/user/me/connections/minecraft/connect/:code")
    @Auth(AuthEnum.Strict)
    async connectMinecraft(
        @Param('code') code: string,
        @Req() request: RequestSession,
        @Res() res: Response
    ): Promise<void> {
        /* connect minecraft profile to account */

        if (code.length != 6) {
            res.status(400).send({
                statusCode: 400,
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
                message_ru: 'Аккаунт Minecraft не привязан'
            });
            return;
        }

        const cache = await this.minecraftService.updateSkinCache(request.session.user.profile.uuid, true);
        if (!cache) {
            res.status(404).send({
                statusCode: 404,
                message: 'Profile not found',
                message_ru: 'Профиль не найден'
            });
            return;
        }

        res.status(200).send({
            statusCode: 200,
            message: "Successfully purged",
            message_ru: 'Кэш успешно обновлён'
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

        if (request.headers['unique-access'] !== process.env.WORKSHOP_TOKEN) {
            res.status(403).send({
                statusCode: 403,
                message: 'Forbidden',
                message_ru: 'Доступ запрещен'
            });
            return;
        }

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

    @Get('/users')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    async get_users(
        @Res() res: Response,
        @Query() query: QueryDTO
    ) {
        res.status(200).send(await this.userService.getUsers(query.query));
    }

    @Patch('/users/:username')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async update_user(
        @Param('username') username: string,
        @Req() request: RequestSession,
        @Res() res: Response,
        @Body() body: UpdateUsersDto
    ) {
        const data = await this.userService.updateUser(request.session, username, body);
        res.status(data.statusCode).send(data);
    }

    @Post('/users')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async force_register(
        @Res() res: Response,
        @Body() body: ForceRegisterUserDTO
    ) {
        /* Force register user */

        const data = await this.userService.forceRegister(body.discord_id);
        res.status(data.statusCode).send(data);
    }

    @Get("/avatars/:user_id")
    async head(
        @Param('user_id') user_id: string,
        @Res({ passthrough: true }) res: Response
    ): Promise<StreamableFile | void> {
        /* get user avatar by id */

        const cache = await this.userService.getAvatar(user_id);
        if (!cache) {
            res.status(500).send({
                statusCode: 500,
                message: 'Unable to get user avatar',
                message_ru: 'Не удалось получить изображение профиля'
            });
            return;
        }

        res.setHeader('Content-Type', 'image/png');
        return new StreamableFile(Buffer.from(cache, "base64"));
    }

    @Patch('/user/me')
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async update_me(
        @Req() request: RequestSession,
        @Res() res: Response,
        @Body() body: UpdateSelfUserDto
    ) {
        /* Update self data */

        const data = await this.userService.updateSelfUser(request.session, body);
        res.status(data.statusCode).send(data);
    }
}