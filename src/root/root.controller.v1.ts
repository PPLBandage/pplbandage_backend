import {
    Body,
    Controller,
    Get,
    Header,
    HttpException,
    Inject,
    Post,
    Req,
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
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

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
        private readonly userService: UserService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache
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

        const cache = await this.cacheManager.get('discord_ping');
        if (cache === 'true') return { message: 'Discord systems operational' };

        const [discord_response, cdn_discord_response] = await Promise.all([
            axios.get(`${process.env.DISCORD_URL}/gateway`, {
                validateStatus: () => true
            }),
            axios.get(`${process.env.DISCORD_AVATAR}`, {
                validateStatus: () => true
            })
        ]);

        if (discord_response.status !== 200)
            throw new HttpException(
                'Discord API returned unexpected status code',
                discord_response.status
            );

        if (![403, 404].includes(cdn_discord_response.status))
            throw new HttpException(
                'Discord CDN returned unexpected status code',
                cdn_discord_response.status
            );

        await this.cacheManager.set('discord_ping', 'true', 1000 * 60 * 3);
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
                BandageModeration: { is_hides: false }
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
            `<@&${process.env.SYSTEM_ROLE_ID}> new feedback:\n${body.content}`,
            process.env.SYSTEM_CHANNEL_ID
        );
    }

    @Post('/error-report')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    @Throttle({ default: { limit: 5, ttl: 1000 * 60 } })
    async errorReport(@Body() body: FeedbackDTO, @Req() req: Request) {
        /* Receive error report */

        const ua = req.headers['user-agent'] ?? 'Unknown agent';
        if (ua.toLocaleLowerCase().includes('bot')) {
            console.log('Received client-side error from bot. Ignoring it...');
            console.log(body.content);
            return;
        }

        await this.discordNotification.doNotification(
            `<@&${process.env.SYSTEM_ROLE_ID}> Client received client-side error:\n${body.content}\n\n` +
                `User agent: ${ua}`,
            process.env.SYSTEM_CHANNEL_ID
        );
    }
}

