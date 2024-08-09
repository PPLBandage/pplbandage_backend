import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { UserService } from 'src/user/user.module';

@Injectable()
export class NoAuthGuard implements CanActivate {
    constructor(private user: UserService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        /* NoAuth Guard */

        const request = context.switchToHttp().getRequest();
        const sessionId = request.cookies?.sessionId;
        const user_agent = request.headers['user-agent'];

        const session = await this.user.validateSession(sessionId, user_agent);
        request.session = session;
        return true;
    }
}