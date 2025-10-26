import {
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Req,
    UseGuards
} from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ConnectionsService } from './connections.service';
import { Auth } from 'src/decorators/auth.decorator';
import { AuthEnum } from 'src/interfaces/types';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import { Throttle } from '@nestjs/throttler';
import responses_minecraft from 'src/localization/minecraft.localization';
import { CodeDTO } from 'src/auth/dto/code.dto';
import { RequestSession } from 'src/interfaces/interfaces';

@Controller({ version: '1', path: 'users/@me/connections' })
@UseGuards(AuthGuard)
export class ConnectionsController {
    constructor(private readonly connectionsService: ConnectionsService) {}

    @Get()
    @Auth(AuthEnum.Strict)
    async connections(@Req() request: RequestSession) {
        return this.connectionsService.getConnections(request.session);
    }

    @Post('minecraft')
    @Auth(AuthEnum.Strict)
    async connectMinecraft(
        @Req() request: RequestSession,
        @Body() body: CodeDTO
    ) {
        /* connect minecraft profile to account */

        if (!body.code || body.code.length != 6)
            throw new LocaleException(responses_minecraft.CODE_NOT_FOUND, 404);

        return await this.connectionsService.connectMinecraft(
            request.session,
            body.code
        );
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('minecraft/cache/purge')
    @Auth(AuthEnum.Strict)
    async purgeSkinCache(@Req() request: RequestSession): Promise<void> {
        /* Purge minecraft skin cache, associated with session's account */

        if (!request.session.user.profile)
            throw new LocaleException(
                responses_minecraft.ACCOUNT_NOT_CONNECTED,
                404
            );

        await this.connectionsService.minecraftService.updateSkinCache(
            request.session.user.profile.uuid,
            true
        );
    }

    @Delete('minecraft')
    @Auth(AuthEnum.Strict)
    async disconnectMinecraft(@Req() request: RequestSession): Promise<void> {
        /* disconnect minecraft profile */

        await this.connectionsService.disconnectMinecraft(request.session);
    }

    @Post('discord')
    @Auth(AuthEnum.Strict)
    async connectDiscord(
        @Req() request: RequestSession,
        @Body() body: CodeDTO
    ) {
        /** Connect discord account */

        await this.connectionsService.connectDiscord(
            request.session,
            body.code
        );
    }

    @Delete('discord')
    @Auth(AuthEnum.Strict)
    async disconnectDiscord(@Req() request: RequestSession) {
        /** Disconnect discord account */

        await this.connectionsService.disconnectDiscord(request.session);
    }

    @Post('google')
    @Auth(AuthEnum.Strict)
    async connectGoogle(@Req() request: RequestSession, @Body() body: CodeDTO) {
        /** Connect google account */

        await this.connectionsService.connectGoogle(request.session, body.code);
    }

    @Delete('google')
    @Auth(AuthEnum.Strict)
    async disconnectGoogle(@Req() request: RequestSession) {
        /** Disconnect google account */

        await this.connectionsService.disconnectGoogle(request.session);
    }

    @Post('twitch')
    @Auth(AuthEnum.Strict)
    async connectTwitch(@Req() request: RequestSession, @Body() body: CodeDTO) {
        /** Connect twitch account */

        await this.connectionsService.connectTwitch(request.session, body.code);
    }

    @Delete('twitch')
    @Auth(AuthEnum.Strict)
    async disconnectTwitch(@Req() request: RequestSession) {
        /** Disconnect twitch account */

        await this.connectionsService.disconnectTwitch(request.session);
    }

    @Post('telegram')
    @Auth(AuthEnum.Strict)
    async connectTelegram(
        @Req() request: RequestSession,
        @Body() body: CodeDTO
    ) {
        /** Connect telegram account */

        await this.connectionsService.connectTelegram(
            request.session,
            body.code
        );
    }

    @Delete('telegram')
    @Auth(AuthEnum.Strict)
    async disconnectTelegram(@Req() request: RequestSession) {
        /** Disconnect telegram account */

        await this.connectionsService.disconnectTelegram(request.session);
    }
}
