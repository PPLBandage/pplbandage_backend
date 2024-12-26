import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { accept_languages } from 'src/localization/common.localization';

@Injectable()
export class LocaleInterceptor implements NestInterceptor {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const request: Request = context.switchToHttp().getRequest();
        const response: Response = context.switchToHttp().getResponse();
        const header = request.headers['accept-language'] || 'en';
        const content_type = request.headers['content-type'];
        const locale = header.toLowerCase().split('-')[0];

        return next
            .handle()
            .pipe(
                map(data => {
                    if (content_type !== 'application/json') return data;
                    return { statusCode: response.statusCode, ...data }
                }),
                catchError(err => {
                    if (err instanceof HttpException) {
                        const response = err.getResponse();
                        const code = err.getStatus();
                        const isResponseLocaled = this.isLocaled(response);

                        return throwError(() =>
                            new HttpException(
                                isResponseLocaled ? this.localizeResponse(locale, response) : response,
                                code
                            )
                        );
                    }
                    return throwError(() => new HttpException(err, 500));
                })
            );
    }

    localizeResponse(
        locale: string,
        body: any
    ) {
        let message = body;
        if (typeof body === 'object') {
            const keys = Object.keys(body);
            if (keys.includes(locale)) message = body[locale];
            else message = body[keys[0]];
        }

        return message;
    }

    isLocaled(body: any) {
        if (typeof body === 'object') {
            return Object.keys(body).some(key => accept_languages.includes(key));
        }
        return false;
    }
}