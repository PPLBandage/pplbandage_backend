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
    Patch,
    HttpException,
    StreamableFile
} from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { UserService } from './user.service';
import { NotificationService } from 'src/notifications/notifications.service';
import { RolesGuard } from 'src/guards/roles.guard';
import { AuthEnum, RolesEnum } from 'src/interfaces/types';
import { Auth } from 'src/decorators/auth.decorator';
import { Roles } from 'src/decorators/access.decorator';
import { UpdateSelfUserDto, UpdateUsersDto } from './dto/body.dto';
import { PageTakeDTO, PageTakeQueryDTO } from './dto/queries.dto';
import { AuthService } from 'src/auth/auth.service';
import { LocalAccessThrottlerGuard } from 'src/guards/throttlerLocalAccess.guard';
import { RequestSession, RequestSessionWeak } from 'src/interfaces/interfaces';

@Controller({ version: '1', path: 'users' })
@UseGuards(AuthGuard, RolesGuard)
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly notificationService: NotificationService,
        private readonly authService: AuthService
    ) {}

    @Get('@me')
    @Auth(AuthEnum.Strict)
    async me(@Req() request: RequestSession) {
        /* get user data, associated with session */

        return await this.userService.getUser(request.session);
    }

    @Patch('@me')
    @Auth(AuthEnum.Strict)
    async updateMe(
        @Req() request: RequestSession,
        @Body() body: UpdateSelfUserDto
    ) {
        /* Update self data */

        await this.userService.updateSelfUser(request.session, body);
    }

    @Delete('@me')
    @Auth(AuthEnum.Strict)
    async logout(@Req() request: RequestSession): Promise<void> {
        /* log out user */

        await this.authService.logout(request.session);
    }

    /*
     * Note: Исторически сложилось так, что `DELETE /users/@me`
     * используется для выхода с аккаунта. Я не буду переносить этот эндпоинт
     * на удаление аккаунта из соображений безопасности и обратной совместимости <3
     *
     * Потому, простите за этот костыль)
     */
    @Delete('@me/delete')
    @Auth(AuthEnum.Strict)
    async deleteAccount(@Req() request: RequestSession): Promise<void> {
        /* delete user */

        await this.userService.deleteMe(request.session);
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
    async getStars(
        @Req() request: RequestSession,
        @Query() query: PageTakeDTO
    ) {
        /* get user's stars */

        return await this.userService.getStars(
            request.session,
            query.page ?? 0,
            query.take ?? 24
        );
    }

    @Get('@me/settings')
    @Auth(AuthEnum.Strict)
    async settings(@Req() request: RequestSession) {
        /* get user's settings */

        return await this.userService.getUserSettings(request.session);
    }

    @Get('@me/notifications')
    @Auth(AuthEnum.Strict)
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

    @Get('@me/subscriptions')
    @Auth(AuthEnum.Strict)
    async getMeSubscriptions(@Req() request: RequestSession) {
        /* get user's subscriptions */

        return await this.userService.getSubscriptions(request.session);
    }

    @Get('@me/subscribers')
    @Auth(AuthEnum.Strict)
    async getMeSSubscribers(@Req() request: RequestSession) {
        /* get user's subscribes */

        return await this.userService.getSubscribers(request.session);
    }

    @Get('@me/autoload-skin')
    @Auth(AuthEnum.Weak)
    async getAutoloadSkin(@Req() request: RequestSessionWeak) {
        const data = await this.userService.getSkinForAutoload(request.session);
        if (!data) throw new HttpException('', 204);
        return new StreamableFile(data, { type: 'image/png' });
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
    @Auth(AuthEnum.Weak)
    async userOg(
        @Param('username') username: string,
        @Req() request: RequestSessionWeak
    ) {
        /* get user data by nickname */

        return await this.userService.getUserOg(username, request.session);
    }

    @Patch(':username')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    async updateUser(
        @Param('username') username: string,
        @Req() request: RequestSession,
        @Body() body: UpdateUsersDto
    ) {
        /* Update user by nickname */

        await this.userService.updateUserAdmin(request.session, username, body);
    }

    @Get('/')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.UpdateUsers])
    async getUsers(@Query() query: PageTakeQueryDTO) {
        /* Get list of registered users */

        return await this.userService.getUsers(
            query.page ?? 0,
            query.take ?? 20,
            query.query
        );
    }
}
