import { Controller, Get, Header, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express'
import { generateSitemap, SitemapProps } from './sitemap.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Auth } from 'src/decorators/auth.decorator';
import { AuthEnum, RolesEnum } from 'src/interfaces/types';
import { Roles } from 'src/decorators/access.decorator';
import { RequestSession } from 'src/app.service';


export const UNAUTHORIZED = {
    status: "error",
    message: "UNAUTHORIZED",
    statusCode: 401
}


@Controller('/api')
@UseGuards(AuthGuard, RolesGuard)
export class RootController {
    constructor(private prisma: PrismaService) { }

    @Get()
    async root(@Res({ passthrough: true }) res: Response) {
        /* main route */

        res.redirect(308, "/");
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

    @Get('/sitemap.xml')
    @Header('Content-Type', 'text/xml')
    async sitemap(): Promise<string> {
        /* sitemap route */

        let urls: SitemapProps[] = [
            { loc: 'https://pplbandage.ru/', priority: 1 },
            { loc: 'https://pplbandage.ru/workshop', priority: 0.8 },
            { loc: 'https://pplbandage.ru/tutorials', priority: 0.7 },
            { loc: 'https://pplbandage.ru/tutorials/bandage', priority: 0.7 },
            { loc: 'https://pplbandage.ru/tutorials/colorable', priority: 0.7 },
            { loc: 'https://pplbandage.ru/me', priority: 0.5 },
            { loc: 'https://pplbandage.ru/tos', priority: 0.5 },
            { loc: 'https://pplbandage.ru/contacts', priority: 0.5 }
        ]

        const bandages = await this.prisma.bandage.findMany({ where: { access_level: 2 } });
        urls = urls.concat(bandages.map((bandage) => ({
            loc: `https://pplbandage.ru/workshop/${bandage.externalId}`,
            priority: 0.6
        })));

        const users = await this.prisma.user.findMany({ where: { Bandage: { some: {} }, UserSettings: { banned: false, public_profile: true } } });
        urls = urls.concat(users.map((user) => ({
            loc: `https://pplbandage.ru/users/${user.username}`,
            priority: 0.5
        })));

        return generateSitemap(urls);
    }

    @Get('/test')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.SuperAdmin])
    async test() {
        return { 'statusCode': 200, 'message': 'Access granted' }
    }
}
