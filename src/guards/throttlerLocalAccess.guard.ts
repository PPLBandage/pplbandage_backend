import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

@Injectable()
export class LocalAccessThrottlerGuard extends ThrottlerGuard {
    protected async handleRequest(
        requestProps: ThrottlerRequest
    ): Promise<boolean> {
        const request = requestProps.context.switchToHttp().getRequest();

        if (request.headers['unique-access'] === process.env.WORKSHOP_TOKEN)
            return true;

        return super.handleRequest(requestProps);
    }
}
