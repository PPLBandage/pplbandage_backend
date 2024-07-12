import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { UserService } from './user.module';
import { Response } from 'express';
import { UNAUTHORIZED } from './app.controller';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private user: UserService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        /* Auth Guard */

        const request = context.switchToHttp().getRequest();
        const response: Response = context.switchToHttp().getResponse();
        const sessionId = request.cookies?.sessionId;
        const user_agent = request.headers['user-agent'];
        
        const session = await this.user.validateSession(sessionId, user_agent);
        if (!session) {
            response.status(401).send(UNAUTHORIZED);
            return false;
        }

        request.session = session;
        response.setHeader('Access-Control-Expose-Headers', 'SetCookie');
        response.setHeader('SetCookie', session.cookie);
        return true;
    }
}