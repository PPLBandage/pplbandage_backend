import {
    Controller,
    Get,
    Param,
    Query,
    Req,
    Delete,
    Post,
    Body,
    UseGuards,
    ValidationPipe,
    UsePipes,
    StreamableFile,
    Patch,
    Header
} from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { UserService } from './user.service';
import { NotificationService } from 'src/notifications/notifications.service';
import { MinecraftService } from 'src/minecraft/minecraft.service';
import { Throttle } from '@nestjs/throttler';
import { RolesGuard } from 'src/guards/roles.guard';
import { AuthEnum, RolesEnum } from 'src/interfaces/types';
import { Auth } from 'src/decorators/auth.decorator';
import { Roles } from 'src/decorators/access.decorator';
import {
    FeedbackDTO,
    ForceRegisterUserDTO,
    UpdateSelfUserDto,
    UpdateUsersDto
} from './dto/body.dto';
import { RequestSession } from 'src/common/bandage_response';
import { PageTakeQueryDTO, QueryDTO } from './dto/queries.dto';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses_minecraft from 'src/localization/minecraft.localization';
import { LocalAccessGuard } from 'src/guards/localAccess.guard';
import { DiscordNotificationService } from 'src/notifications/discord.service';

@Controller({ version: '1' })
@UseGuards(AuthGuard, RolesGuard)
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly notificationService: NotificationService,
        private readonly minecraftService: MinecraftService,
        private readonly discordNotification: DiscordNotificationService
    ) {}

    @Get('user/me')
    @Auth(AuthEnum.Strict)
    async me(@Req() request: RequestSession) {
        /* get user data. associated with session */

        return await this.userService.getUser(request.session);
    }

    @Get('/user/me/works')
    @Auth(AuthEnum.Strict)
    async getWorks(@Req() request: RequestSession) {
        /* get user's works */

        return await this.userService.getWork(request.session);
    }

    @Get('/user/me/stars')
    @Auth(AuthEnum.Strict)
    async getStars(@Req() request: RequestSession) {
        /* get user's stars */

        return await this.userService.getStars(request.session);
    }

    @Get('user/me/settings')
    @Auth(AuthEnum.Strict)
    async minecraft(@Req() request: RequestSession) {
        /* get user's settings */

        return await this.userService.getUserSettings(request.session);
    }

    @Get('/user/me/notifications')
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async getNotifications(
        @Req() request: RequestSession,
        @Query() query: PageTakeQueryDTO
    ) {
        /* get user's connections */

        return await this.notificationService.get(
            request.session,
            query.take || 5,
            query.page || 0
        );
    }

    @Post('/user/me/connections/minecraft/connect/:code')
    @Auth(AuthEnum.Strict)
    async connectMinecraft(
        @Param('code') code: string,
        @Req() request: RequestSession
    ) {
        /* connect minecraft profile to account */

        if (code.length != 6)
            throw new LocaleException(responses_minecraft.CODE_NOT_FOUND, 404);

        return await this.minecraftService.connect(request.session, code);
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('/user/me/connections/minecraft/cache/purge')
    @Auth(AuthEnum.Strict)
    async purgeSkinCache(@Req() request: RequestSession): Promise<void> {
        /* Purge minecraft skin cache, associated with session's account */

        if (!request.session.user.profile)
            throw new LocaleException(
                responses_minecraft.ACCOUNT_NOT_CONNECTED,
                404
            );

        await this.minecraftService.updateSkinCache(
            request.session.user.profile.uuid,
            true
        );
    }

    @Delete('/user/me/connections/minecraft')
    @Auth(AuthEnum.Strict)
    async disconnectMinecraft(@Req() request: RequestSession): Promise<void> {
        /* disconnect minecraft profile */

        await this.minecraftService.disconnect(request.session);
    }

    @Get('/users/:username')
    @Auth(AuthEnum.Weak)
    @UseGuards(new LocalAccessGuard())
    async user_profile(
        @Param('username') username: string,
        @Req() request: RequestSession
    ) {
        /* get user data by nickname */
        return await this.userService.getUserByNickname(
            username,
            request.session
        );
    }

    @Get('/users/:username/og')
    async userOg(@Param('username') username: string) {
        /* get user data by nickname */

        return await this.userService.getUserOg(username);
    }

    @Get('users')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    async getUsers(@Query() query: QueryDTO) {
        /* Get list of registered users */

        return await this.userService.getUsers(query.query);
    }

    @Patch('/users/:username')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async updateUser(
        @Param('username') username: string,
        @Req() request: RequestSession,
        @Body() body: UpdateUsersDto
    ) {
        /* Update user by nickname */

        await this.userService.updateUser(request.session, username, body);
    }

    @Post('/users')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async forceRegister(@Body() body: ForceRegisterUserDTO) {
        /* Force register user */

        return await this.userService.forceRegister(body.discord_id);
    }

    @Get('/avatars/:user_id')
    @Header('Content-Type', 'image/png')
    async head(
        @Param('user_id') user_id: string
    ): Promise<StreamableFile | void> {
        /* get user avatar by id */

        return new StreamableFile(
            Buffer.from(await this.userService.getAvatar(user_id), 'base64')
        );
    }

    @Patch('/user/me')
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async updateMe(
        @Req() request: RequestSession,
        @Body() body: UpdateSelfUserDto
    ) {
        /* Update self data */

        await this.userService.updateSelfUser(request.session, body);
    }

    @Post('/user/feedback')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    @Throttle({ default: { limit: 1, ttl: 1000 * 60 } })
    async feedback(@Body() body: FeedbackDTO) {
        /* Receive feedback */

        await this.discordNotification.doNotification(
            `<@&${process.env.MENTION_ROLE_ID}> new feedback:\n${body.content}`
        );
    }
}
