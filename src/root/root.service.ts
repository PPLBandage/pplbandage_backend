import { Injectable } from '@nestjs/common';

export interface SitemapProps {
    loc: string,
    lastmod?: string,
    priority?: string | number,
    changefreq?: string
}

@Injectable()
export class RootService {
    constructor() { }

    generateSitemap(elements: SitemapProps[]) {
        const elements_str = elements.map((element) => {
            return (
                '<url>\n' +
                `<loc>${element.loc}</loc>\n` +
                (element.lastmod ? `<lastmod>${element.lastmod}</lastmod>\n` : '') +
                (element.priority ? `<priority>${element.priority}</priority>\n` : '') +
                (element.changefreq ? `<changefreq>${element.changefreq}</changefreq>\n` : '') +
                '</url>\n'
            );
        });

        const xml_urls = elements_str.join('');
        const result = (
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
            xml_urls +
            '</urlset>'
        );

        return result;
    }
}
