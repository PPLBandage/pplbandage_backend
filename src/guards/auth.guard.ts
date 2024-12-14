import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Response } from 'express';
import { UNAUTHORIZED } from '../root/root.controller';
import { AuthService } from 'src/auth/auth.service';
import { Reflector } from '@nestjs/core';
import { Auth } from 'src/decorators/auth.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private prisma: PrismaService,
        private oathService: AuthService,
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

        const session = await this.oathService.validateSession(sessionId, user_agent, strict === 'Strict');
        if (!session && strict === 'Strict') {
            response.status(401).send(UNAUTHORIZED);
            return false;
        }

        request.session = session;
        if (session) {
            response.setHeader('SetCookie', session.cookie);
            try {
                await this.prisma.sessions.update({
                    where: { sessionId: session.sessionId },
                    data: { last_accessed: new Date() }
                });
            } catch (e) {
                console.error(`Failed to update last access for session: ${e}`);
            }
        }

        return true;
    }
}