import {
    Body,
    Controller,
    Get,
    Header,
    HttpException,
    Param,
    Post,
    Req,
    StreamableFile,
    UsePipes,
    ValidationPipe
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from 'express';
import { RootService, SitemapProps } from './root.service';
import { FeedbackDTO } from 'src/user/dto/body.dto';
import { DiscordNotificationService } from 'src/notifications/discord.service';
import { UserService } from 'src/user/user.service';
import axios from 'axios';

export const UNAUTHORIZED = {
    statusCode: 401,
    message: 'UNAUTHORIZED',
    message_ru: 'Неавторизован'
};

@Controller({ version: '1' })
export class RootController {
    constructor(
        private prisma: PrismaService,
        private readonly rootService: RootService,
        private readonly discordNotification: DiscordNotificationService,
        private readonly userService: UserService
    ) {}

    @Get()
    async root(@Req() req: Request) {
        /* Root API Path */

        const sha = process.env.COMMIT_SHA;
        const commit = await this.rootService.getCommitInfo(sha ?? '');
        return {
            message: 'Привет! Я здесь, чтобы сказать, что все работает!',
            main_site: 'https://pplbandage.ru',
            docs: 'https://github.com/PPLBandage/pplbandage_backend/blob/main/README.md',
            version: {
                route: req.route.path.split('/').at(-1),
                build: {
                    sha: sha,
                    date: commit.committer.date,
                    message: commit.message
                }
            }
        };
    }

    @Get('/ping')
    @SkipThrottle()
    async ping() {
        /* Ping endpoint */

        return { message: 'pong' };
    }

    @Get('/ping/discord')
    async pingDiscord() {
        /* Discord ping endpoint */

        const [discord_response, cdn_discord_response] = await Promise.all([
            axios.get(`${process.env.DISCORD_URL}/api/v10/gateway`),
            axios.get(`${process.env.DISCORD_AVATAR}`, {
                validateStatus: status => status === 404
            })
        ]);

        if (discord_response.status !== 200)
            throw new HttpException(
                'Discord API returned unexpected status code',
                503
            );

        if (cdn_discord_response.status !== 404)
            throw new HttpException(
                'Discord CDN returned unexpected status code',
                503
            );

        return { message: 'Discord systems operational' };
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
        ];

        const bandages = await this.prisma.bandage.findMany({
            where: {
                access_level: 2,
                categories: { none: { only_admins: true } }
            }
        });
        urls = urls.concat(
            bandages.map(bandage => ({
                loc: `https://pplbandage.ru/workshop/${bandage.externalId}`,
                priority: 0.6
            }))
        );

        const users = await this.prisma.user.findMany({
            where: {
                discordId: { gte: '0' },
                Bandage: { some: {} },
                UserSettings: { banned: false, public_profile: true }
            }
        });
        urls = urls.concat(
            users.map(user => ({
                loc: `https://pplbandage.ru/users/${user.username}`,
                priority: 0.5
            }))
        );

        return this.rootService.generateSitemap(urls);
    }

    @Post('/feedback')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    @Throttle({ default: { limit: 1, ttl: 1000 * 60 } })
    async feedback(@Body() body: FeedbackDTO) {
        /* Receive feedback */

        await this.discordNotification.doNotification(
            `<@&${process.env.MENTION_ROLE_ID}> new feedback:\n${body.content}`
        );
    }

    @Get('/avatars/:user_id')
    @Header('Content-Type', 'image/png')
    async head(
        @Param('user_id') user_id: string
    ): Promise<StreamableFile | void> {
        /* get user avatar by id */

        return new StreamableFile(
            Buffer.from(await this.userService.getAvatar(user_id), 'base64')
        );
    }
}
