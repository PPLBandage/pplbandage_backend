import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.module';
import { Response } from 'express';
import { UNAUTHORIZED } from './app.controller';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private user: UserService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const response: Response = context.switchToHttp().getResponse();
        const sessionId = request.cookies?.sessionId;
        
        const session = await this.user.validateSession(sessionId);
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