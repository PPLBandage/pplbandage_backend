import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Req,
    UseGuards
} from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ConnectionsService } from './connections.service';
import { Auth } from 'src/decorators/auth.decorator';
import { AuthEnum } from 'src/interfaces/types';
import { RequestSession } from 'src/common/bandage_response';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import { Throttle } from '@nestjs/throttler';
import responses_minecraft from 'src/localization/minecraft.localization';

@Controller({ version: '1', path: 'users/@me/connections' })
@UseGuards(AuthGuard)
export class ConnectionsController {
    constructor(private readonly connectionsService: ConnectionsService) {}

    @Get()
    @Auth(AuthEnum.Strict)
    async connections(@Req() request: RequestSession) {
        return this.connectionsService.getConnections(request.session);
    }

    @Post('minecraft/connect/:code')
    @Auth(AuthEnum.Strict)
    async connectMinecraft(
        @Param('code') code: string,
        @Req() request: RequestSession
    ) {
        /* connect minecraft profile to account */

        if (code.length != 6)
            throw new LocaleException(responses_minecraft.CODE_NOT_FOUND, 404);

        return await this.connectionsService.connectMinecraft(
            request.session,
            code
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
        @Body() body: { code: string }
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
}

