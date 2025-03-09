import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const generateKey = (context: ExecutionContext): string => {
    const request: Request = context.switchToHttp().getRequest();
    return `${request.cookies.accessToken}:${request.params.id}`;
};
