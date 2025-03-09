import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const generateKey = (
    context: ExecutionContext,
    _trackerString: string,
    _throttlerName: string
): string => {
    const request: Request = context.switchToHttp().getRequest();
    return `${request.cookies.accessToken}:${request.params.id}`;
};
