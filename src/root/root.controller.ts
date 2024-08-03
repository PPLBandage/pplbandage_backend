import { Controller, Get, Header, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express'
import { generateSitemap, SitemapProps } from './sitemap.module';
import { PrismaService } from 'src/prisma/prisma.service';


export const UNAUTHORIZED = {
    status: "error",
    message: "UNAUTHORIZED",
    statusCode: 401
}


@Controller('/api')
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
            { loc: 'https://pplbandage.ru/workshop/create', priority: 0.8 },
            { loc: 'https://pplbandage.ru/tutorials', priority: 0.7 },
            { loc: 'https://pplbandage.ru/tutorials/bandage', priority: 0.7 },
            { loc: 'https://pplbandage.ru/tutorials/colorable', priority: 0.7 },
            { loc: 'https://pplbandage.ru/me', priority: 0.5 },
            { loc: 'https://pplbandage.ru/me/stars', priority: 0.5 },
            { loc: 'https://pplbandage.ru/me/notifications', priority: 0.5 },
            { loc: 'https://pplbandage.ru/me/connections', priority: 0.5 },
            { loc: 'https://pplbandage.ru/tos', priority: 0.5 },
            { loc: 'https://pplbandage.ru/contacts', priority: 0.5 }
        ]

        const bandages = await this.prisma.bandage.findMany({ where: { access_level: 2 } });
        urls = urls.concat(bandages.map((bandage) => ({
            loc: `https://pplbandage.ru/workshop/${bandage.externalId}`,
            priority: 0.6
        })));

        const users = await this.prisma.user.findMany({ where: { Bandage: { some: {} } } });
        urls = urls.concat(users.map((user) => ({
            loc: `https://pplbandage.ru/users/${user.username}`,
            priority: 0.5
        })));

        return generateSitemap(urls);
    }
}
