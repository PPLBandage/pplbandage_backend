import { Controller, Get, Res } from '@nestjs/common';
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
}
