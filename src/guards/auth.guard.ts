import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Response } from 'express';
import { UNAUTHORIZED } from '../root/root.controller';
import { OauthService } from 'src/oauth/oauth.module';
import { Reflector } from '@nestjs/core';
import { Auth } from 'src/decorators/auth.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private oathService: OauthService,
        private reflector: Reflector
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        /* Auth Guard */

        const request = context.switchToHttp().getRequest();
        const response: Response = context.switchToHttp().getResponse();
        const strict = this.reflector.get(Auth, context.getHandler());
        const sessionId = request.cookies?.sessionId;
        const user_agent = request.headers['user-agent'];

        if (!strict) {
            return true;
        }

        const session = await this.oathService.validateSession(sessionId, user_agent);
        if (!session && strict === 'Strict') {
            response.status(401).send(UNAUTHORIZED);
            return false;
        }

        request.session = session;
        if (session && strict === 'Strict') {
            response.setHeader('Access-Control-Expose-Headers', 'SetCookie');
            response.setHeader('SetCookie', session.cookie);
        }
        return true;
    }
}