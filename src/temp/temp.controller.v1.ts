import {
    Controller,
    NotFoundException,
    Param,
    Post,
    Req,
    UseGuards
} from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { TempService } from './temp.service';
import { Auth } from 'src/decorators/auth.decorator';
import { AuthEnum } from 'src/interfaces/types';
import { RequestSession } from 'src/interfaces/interfaces';

@Controller({ version: '1', path: 'temp' })
@UseGuards(AuthGuard, RolesGuard)
export class TempController {
    constructor(private readonly tempService: TempService) {}

    @Post('redeem/{:code}')
    @Auth(AuthEnum.Strict)
    async redeem(@Param('code') code: string, @Req() req: RequestSession) {
        if (code !== process.env.TEMPORAL_STATIC_REDEEM_CODE)
            throw new NotFoundException();

        await this.tempService.redeemExclusiveBadge(req.session);
    }
}
