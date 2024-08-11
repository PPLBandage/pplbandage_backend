import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { RequestSessionWeak } from 'src/app.service';
import { Roles } from 'src/decorators/access.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private reflector: Reflector
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request: RequestSessionWeak = context.switchToHttp().getRequest();
        const response: Response = context.switchToHttp().getResponse();
        const roles = this.reflector.get(Roles, context.getHandler());
        const user_access_level = request.session?.user.AccessRoles?.level;
        if (!roles) {
            return true;
        }

        if (!user_access_level || roles > user_access_level) {
            response.status(403).send({
                statusCode: 403,
                message: 'Forbidden'
            });
            return false;
        }

        return true;
    }
}