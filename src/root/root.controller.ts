import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express'


export const UNAUTHORIZED = {
    status: "error",
    message: "UNAUTHORIZED",
    statusCode: 401
}


@Controller('/api')
export class RootController {
    constructor() { }

    @Get()
    async root(@Res({ passthrough: true }) res: Response) {
        /* main route */

        res.redirect(301, "/");
    }

    @Get('/ping')
    @SkipThrottle()
    async ping(@Res({ passthrough: true }) res: Response) {
        /* ping route */

        res.status(200).send({
            statusCode: 200,
            message: 'pong'
        })
    }
}
