import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import axios from 'axios';
import { CommitType } from './types';

export interface SitemapProps {
    loc: string;
    lastmod?: string;
    priority?: string | number;
    changefreq?: string;
}

@Injectable()
export class RootService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    generateSitemap(elements: SitemapProps[]) {
        const elements_str = elements.map(element => {
            return (
                '<url>\n' +
                `<loc>${element.loc}</loc>\n` +
                (element.lastmod
                    ? `<lastmod>${element.lastmod}</lastmod>\n`
                    : '') +
                (element.priority
                    ? `<priority>${element.priority}</priority>\n`
                    : '') +
                (element.changefreq
                    ? `<changefreq>${element.changefreq}</changefreq>\n`
                    : '') +
                '</url>\n'
            );
        });

        const xml_urls = elements_str.join('');
        const result =
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
            xml_urls +
            '</urlset>';

        return result;
    }

    async getCommitInfo(sha: string): Promise<CommitType> {
        const commit: string | null =
            await this.cacheManager.get('build_commit');
        let data;

        if (!commit) {
            const result = await axios.get(
                `https://api.github.com/repos/PPLBandage/pplbandage_backend/commits/${sha}`
            );
            data = result.data.commit;
            await this.cacheManager.set(
                'build_commit',
                JSON.stringify(data),
                1000 * 3600
            );
        } else {
            data = JSON.parse(commit);
        }

        return data;
    }
}
