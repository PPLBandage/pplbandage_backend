import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.module';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private user: UserService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const sessionId = request.cookies?.sessionId;
        
        const session = await this.user.validateSession(sessionId);
        if (!session) {
            throw new UnauthorizedException('Invalid token');
        }

        request.session = session;
        response.setHeader('Access-Control-Expose-Headers', 'SetCookie');
        response.setHeader('SetCookie', session.cookie);
        return true;
    }
}