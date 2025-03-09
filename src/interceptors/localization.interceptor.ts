/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    HttpException,
    HttpStatus
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { accept_languages } from 'src/localization/common.localization';
import responses from 'src/localization/common.localization';

export class LocaleException extends HttpException {
    constructor(message: any, status: HttpStatus) {
        super(message, status);
    }
}

@Injectable()
export class LocaleInterceptor implements NestInterceptor {
    async intercept(
        context: ExecutionContext,
        next: CallHandler
    ): Promise<Observable<any>> {
        const request: Request = context.switchToHttp().getRequest();
        const response: Response = context.switchToHttp().getResponse();
        const header = request.headers['accept-language'] || 'en';
        const contentType =
            (response.getHeader('content-type') as string) || '';
        const locale = header.toLowerCase().split('-')[0];

        return next.handle().pipe(
            map(data => {
                if (
                    !!contentType &&
                    !contentType.toLowerCase().includes('application/json')
                )
                    return data;
                if (data instanceof Array) return data;
                if (request.path.includes('badge')) return data;

                return { statusCode: response.statusCode, ...data };
            }),
            catchError(err => {
                if (err instanceof LocaleException) {
                    const response = err.getResponse();
                    const code = err.getStatus();
                    const isLocalized = this.isLocaled(response);

                    const localizedResponse = isLocalized
                        ? this.localizeResponse(locale, response)
                        : response;

                    return throwError(
                        () => new HttpException(localizedResponse, code)
                    );
                }

                if (err instanceof HttpException) {
                    return throwError(() => err);
                }

                console.error(err);
                return throwError(
                    () =>
                        new HttpException(
                            {
                                statusCode: 500,
                                message: this.localizeResponse(
                                    locale,
                                    responses.INTERNAL_ERROR
                                )
                            },
                            500
                        )
                );
            })
        );
    }

    localizeResponse(locale: string, body: any): any {
        if (typeof body === 'object' && body !== null) {
            const localizedMessage = body[locale] || body['en'];
            return localizedMessage || body;
        }
        return body;
    }

    isLocaled(body: any): boolean {
        return (
            typeof body === 'object' &&
            Object.keys(body).some(key => accept_languages.includes(key))
        );
    }
}
