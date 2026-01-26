import { Injectable } from '@nestjs/common';
import { open } from 'fs/promises';
import puppeteer, { Browser, Page } from 'puppeteer';

declare global {
    interface Window {
        __RENDER_DONE__?: boolean;
        __RENDER_RESULT__?: string;
    }
}

interface Task {
    id: number;
    page: Page;
}

@Injectable()
export class ThumbnailsService {
    browser?: Browser;
    template_page!: string;

    tasks: Task[] = [];
    task_index: number = 0;

    constructor() {
        void this.loadTemplate();
    }

    async loadTemplate() {
        const f = await open('./src/thumbnails/index.html');
        this.template_page = (await f.readFile()).toString();
        f.close();
    }

    async launch() {
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--enable-3d-apis'
            ]
        });
    }

    async stop() {
        if (!this.browser) return;
        this.browser.close();
    }

    async render(b64: string, colorable: boolean) {
        if (!this.browser) {
            await this.launch();
        }

        const page = await this.browser!.newPage();
        const page_contents = this.template_page
            .replace('{{BANDAGE}}', b64)
            .replace('"{{COLORABLE}}"', colorable + '');

        await page.setContent(page_contents);
        const index = ++this.task_index;

        this.tasks.push({
            id: index,
            page: page
        });

        const render = async () => {
            await page.waitForFunction(() => window.__RENDER_DONE__ === true);
            const img = await page.evaluate(() => window.__RENDER_RESULT__!);

            return img.replace('data:image/png;base64,', '');
        };

        return await Promise.race([render()]);
    }
}
