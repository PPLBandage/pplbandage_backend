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
    Patch,
    HttpException
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
import type { Request } from 'express';
import {
    ForceRegisterUserDTO,
    UpdateSelfUserDto,
    UpdateUsersDto
} from './dto/body.dto';
import {
    RequestSession,
    RequestSessionWeak
} from 'src/common/bandage_response';
import { PageTakeDTO, PageTakeQueryDTO } from './dto/queries.dto';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses_minecraft from 'src/localization/minecraft.localization';
import { AuthService } from 'src/auth/auth.service';
import responses from 'src/localization/common.localization';
import { LocalAccessThrottlerGuard } from 'src/guards/throttlerLocalAccess.guard';

@Controller({ version: '1', path: 'users' })
@UseGuards(AuthGuard, RolesGuard)
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly notificationService: NotificationService,
        private readonly minecraftService: MinecraftService,
        private readonly authService: AuthService
    ) {}

    @Get('@me')
    @Auth(AuthEnum.Strict)
    async me(@Req() request: RequestSession) {
        /* get user data. associated with session */

        return await this.userService.getUser(request.session);
    }

    @Patch('@me')
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async updateMe(
        @Req() request: RequestSession,
        @Body() body: UpdateSelfUserDto
    ) {
        /* Update self data */

        await this.userService.updateSelfUser(request.session, body);
    }

    @Delete('@me')
    async logout(@Req() request: Request): Promise<void> {
        /* log out user */

        const user_agent = request.headers['user-agent'];
        const session = await this.authService.validateSession(
            request.cookies.sessionId,
            user_agent as string,
            true
        );
        if (!session) throw new LocaleException(responses.UNAUTHORIZED, 401);

        await this.authService.logout(session);
    }

    @Get('/@me/sessions')
    @Auth(AuthEnum.Strict)
    async getSessions(@Req() request: RequestSession) {
        /* get user sessions */

        return await this.authService.getSessions(request.session);
    }

    @Delete('/@me/sessions/all')
    @Auth(AuthEnum.Strict)
    async deleteAllSessions(@Req() request: RequestSession) {
        /* log out from all sessions */

        await this.authService.deleteSessionAll(request.session);
    }

    @Delete('/@me/sessions/:id')
    @Auth(AuthEnum.Strict)
    async deleteSession(
        @Param('id') id: string,
        @Req() request: RequestSession
    ) {
        /* log out from session by id */

        if (isNaN(Number(id)))
            throw new HttpException('Invalid session id', 400);

        await this.authService.deleteSession(request.session, Number(id));
    }

    @Get('@me/works')
    @Auth(AuthEnum.Strict)
    async getWorks(@Req() request: RequestSession) {
        /* get user's works */

        return await this.userService.getWork(request.session);
    }

    @Get('@me/stars')
    @Auth(AuthEnum.Strict)
    async getStars(@Req() request: RequestSession) {
        /* get user's stars */

        return await this.userService.getStars(request.session);
    }

    @Get('@me/settings')
    @Auth(AuthEnum.Strict)
    async minecraft(@Req() request: RequestSession) {
        /* get user's settings */

        return await this.userService.getUserSettings(request.session);
    }

    @Get('@me/notifications')
    @Auth(AuthEnum.Strict)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async getNotifications(
        @Req() request: RequestSession,
        @Query() query: PageTakeDTO
    ) {
        /* get user's connections */

        return await this.notificationService.get(
            request.session,
            query.take || 5,
            query.page || 0
        );
    }

    @Post('@me/connections/minecraft/connect/:code')
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
    @Post('@me/connections/minecraft/cache/purge')
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

    @Delete('@me/connections/minecraft')
    @Auth(AuthEnum.Strict)
    async disconnectMinecraft(@Req() request: RequestSession): Promise<void> {
        /* disconnect minecraft profile */

        await this.minecraftService.disconnect(request.session);
    }

    @Get(':username')
    @Auth(AuthEnum.Weak)
    @UseGuards(LocalAccessThrottlerGuard)
    async userProfile(
        @Param('username') username: string,
        @Req() request: RequestSessionWeak
    ) {
        /* get user data by nickname */
        return await this.userService.getUserByNickname(
            username,
            request.session
        );
    }

    @Post(':username/subscribers')
    @Auth(AuthEnum.Strict)
    async subscribeTo(
        @Param('username') username: string,
        @Req() request: RequestSession
    ) {
        /* Subscribe to user by nickname */
        return await this.userService.subscribeTo(username, request.session);
    }

    @Delete(':username/subscribers')
    @Auth(AuthEnum.Strict)
    async unsubscribeFrom(
        @Param('username') username: string,
        @Req() request: RequestSession
    ) {
        /* Unsubscribe from user by nickname */
        return await this.userService.unsubscribeFrom(
            username,
            request.session
        );
    }

    @Get(':username/og')
    async userOg(@Param('username') username: string) {
        /* get user data by nickname */

        return await this.userService.getUserOg(username);
    }

    @Patch(':username')
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

    @Get('/')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async getUsers(@Query() query: PageTakeQueryDTO) {
        /* Get list of registered users */

        return await this.userService.getUsers(
            query.page ?? 0,
            query.take ?? 20,
            query.query
        );
    }

    @Post('/')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async forceRegister(@Body() body: ForceRegisterUserDTO) {
        /* Force register user */

        return await this.userService.forceRegister(body.discord_id);
    }
}
