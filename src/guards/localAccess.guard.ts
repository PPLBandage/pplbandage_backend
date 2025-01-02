import { Injectable, CanActivate, ExecutionContext, HttpException } from '@nestjs/common';
import { Request } from 'express';


@Injectable()
export class LocalAccessGuard implements CanActivate {
    constructor() { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request: Request = context.switchToHttp().getRequest();

        if (request.headers['unique-access'] !== process.env.WORKSHOP_TOKEN)
            throw new HttpException('Forbidden', 403);

        return true;
    }
}