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
        if (!this.browser || !this.browser.connected) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--enable-3d-apis'
                ]
            });
        }
    }

    async stop() {
        if (!this.browser) return;
        await this.browser.close();
        this.browser = undefined;
    }

    async render(b64: string, colorable: boolean): Promise<string> {
        const index = ++this.task_index;
        try {
            return await Promise.race([
                this._render(index, b64, colorable),
                new Promise<never>((_, reject) => setTimeout(reject, 80000))
            ]);
        } catch (e) {
            throw e;
        } finally {
            const task = this.tasks.find(el => el.id == index);
            if (task) {
                await task.page.close();
                this.tasks = this.tasks.filter(el => el.id !== index);
            }

            if (this.tasks.length === 0) {
                this.stop();
            }
        }
    }

    async _render(index: number, b64: string, colorable: boolean) {
        await this.launch();

        const page = await this.browser!.newPage();
        const page_contents = this.template_page
            .replace('{{BANDAGE}}', b64)
            .replace('"{{COLORABLE}}"', colorable + '');

        await page.setContent(page_contents);

        this.tasks.push({
            id: index,
            page: page
        });

        await page.waitForFunction(() => window.__RENDER_DONE__ === true);
        const img = await page.evaluate(() => window.__RENDER_RESULT__!);

        return img.replace('data:image/png;base64,', '');
    }
}
