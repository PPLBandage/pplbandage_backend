import {
    Injectable,
    CanActivate,
    ExecutionContext,
    Logger,
    HttpException
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from 'src/auth/auth.service';
import { Reflector } from '@nestjs/core';
import { Auth } from 'src/decorators/auth.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestSessionWeak } from 'src/common/bandage_response';

@Injectable()
export class AuthGuard implements CanActivate {
    private readonly logger = new Logger(AuthGuard.name);
    constructor(
        private prisma: PrismaService,
        private oathService: AuthService,
        private reflector: Reflector
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        /* Auth Guard */

        this.logger.debug('Received request');
        const request: RequestSessionWeak = context.switchToHttp().getRequest();
        const response: Response = context.switchToHttp().getResponse();
        const strict = this.reflector.get(Auth, context.getHandler());
        const sessionId = request.cookies?.sessionId;
        const user_agent = request.headers['user-agent'] ?? '';

        if (!strict) {
            return true;
        }

        const session = await this.oathService.validateSession(
            sessionId,
            user_agent,
            strict === 'Strict'
        );

        this.logger.debug('Session validated');
        if (!session && strict === 'Strict')
            throw new HttpException('Unauthorized', 401);

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

        this.logger.debug('Request processed successfully');
        return true;
    }
}
