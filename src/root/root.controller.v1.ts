import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express'
import { PrismaService } from 'src/prisma/prisma.service';
import { RootService, SitemapProps } from './root.service';

export const UNAUTHORIZED = {
    statusCode: 401,
    message: "UNAUTHORIZED",
    message_ru: 'Неавторизован',
}

@Controller({ version: '1' })
export class RootController {
    constructor(private prisma: PrismaService,
        private readonly rootService: RootService
    ) { }

    @Get()
    async root(@Res({ passthrough: true }) res: Response) {
        /* Redirect to root path */

        res.redirect(308, "/");
    }

    @Get('/ping')
    @SkipThrottle()
    async ping(@Res() res: Response) {
        /* Ping endpoint */

        res.status(200).send({
            statusCode: 200,
            message: 'pong'
        });
    }

    @Get('/sitemap.xml')
    @Header('Content-Type', 'text/xml')
    async sitemap(): Promise<string> {
        /* Generate sitemap */

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
        urls = urls.concat(bandages.map(bandage => ({
            loc: `https://pplbandage.ru/workshop/${bandage.externalId}`,
            priority: 0.6
        })));

        const users = await this.prisma.user.findMany({
            where: {
                discordId: { gte: '0' },
                Bandage: { some: {} },
                UserSettings: { banned: false, public_profile: true }
            }
        });
        urls = urls.concat(users.map(user => ({
            loc: `https://pplbandage.ru/users/${user.username}`,
            priority: 0.5
        })));

        return this.rootService.generateSitemap(urls);
    }
}
