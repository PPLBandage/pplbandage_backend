import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { RequestSessionWeak } from 'src/common/bandage_response';
import { Roles } from 'src/decorators/access.decorator';
import { RolesEnum } from 'src/interfaces/types';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request: RequestSessionWeak = context.switchToHttp().getRequest();
        const response: Response = context.switchToHttp().getResponse();
        const roles = this.reflector.get(Roles, context.getHandler());
        const user_roles = request.session?.user.AccessRoles.map(
            role => role.level
        );

        console.log(user_roles);
        if (!roles) {
            return true;
        }

        if (user_roles?.includes(RolesEnum.SuperAdmin)) {
            return true;
        }

        if (roles.some(role => user_roles?.includes(role))) {
            return true;
        }

        response.status(403).send({
            statusCode: 403,
            message: 'Forbidden',
            message_ru: 'Доступ запрещен'
        });
        return false;
    }
}
