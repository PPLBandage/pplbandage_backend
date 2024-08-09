import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { OauthService } from 'src/oauth/oauth.module';

@Injectable()
export class NoAuthGuard implements CanActivate {
    constructor(private oathService: OauthService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        /* NoAuth Guard */

        const request = context.switchToHttp().getRequest();
        const sessionId = request.cookies?.sessionId;
        const user_agent = request.headers['user-agent'];

        const session = await this.oathService.validateSession(sessionId, user_agent);
        request.session = session;
        return true;
    }
}