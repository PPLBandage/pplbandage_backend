import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { open } from 'fs/promises';
import puppeteer, { Browser, Page } from 'puppeteer';

declare global {
    interface Window {
        __RENDER_DONE__?: boolean;
        __RENDER_RESULT__?: string;
    }
}

interface RenderTask {
    b64: string;
    colorable: boolean;
    resolve: (value: string) => void;
    reject: (reason?: unknown) => void;
}

@Injectable()
export class ThumbnailsService implements OnModuleDestroy {
    private browser?: Browser;
    private template_page!: string;

    private readonly MAX_CONCURRENCY = 5;
    private readonly IDLE_TIMEOUT_MS = 5000;

    private activeCount = 0;
    private queue: RenderTask[] = [];
    private idleTimer?: NodeJS.Timeout;

    private browserLaunching?: Promise<void>;

    constructor() {
        void this.loadTemplate();
    }

    async onModuleDestroy() {
        await this.stop();
    }

    private async loadTemplate() {
        const f = await open('./src/thumbnails/index.html');
        this.template_page = (await f.readFile()).toString();
        await f.close();
    }

    private async launch() {
        if (this.browser?.connected) return;

        if (!this.browserLaunching) {
            this.browserLaunching = (async () => {
                this.browser = await puppeteer.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--enable-3d-apis'
                    ]
                });
            })().finally(() => {
                this.browserLaunching = undefined;
            });
        }

        await this.browserLaunching;
    }

    private async stop() {
        if (this.browser) {
            await this.browser.close();
            this.browser = undefined;
        }
    }

    render(b64: string, colorable: boolean): Promise<string> {
        this.clearIdleTimer();

        return new Promise((resolve, reject) => {
            this.queue.push({ b64, colorable, resolve, reject });
            this.processQueue();
        });
    }

    private processQueue() {
        while (
            this.activeCount < this.MAX_CONCURRENCY &&
            this.queue.length > 0
        ) {
            const task = this.queue.shift()!;
            this.activeCount++;

            this.runTask(task)
                .then(task.resolve)
                .catch(task.reject)
                .finally(() => {
                    this.activeCount--;
                    this.processQueue();
                    this.scheduleIdleShutdownIfNeeded();
                });
        }
    }

    private scheduleIdleShutdownIfNeeded() {
        if (this.activeCount === 0 && this.queue.length === 0) {
            this.clearIdleTimer();

            this.idleTimer = setTimeout(() => {
                if (this.activeCount === 0 && this.queue.length === 0) {
                    void this.stop();
                }
            }, this.IDLE_TIMEOUT_MS);
        }
    }

    private clearIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = undefined;
        }
    }

    private async runTask(task: RenderTask): Promise<string> {
        await this.launch();

        let page: Page | undefined;

        try {
            page = await this.browser!.newPage();

            const pageContents = this.template_page
                .replace('{{BANDAGE}}', task.b64)
                .replace('"{{COLORABLE}}"', String(task.colorable));

            await page.setContent(pageContents, { waitUntil: 'load' });

            await page.waitForFunction(() => window.__RENDER_DONE__ === true, {
                timeout: 8000
            });

            const img = await page.evaluate(() => window.__RENDER_RESULT__!);
            return img.replace('data:image/png;base64,', '');
        } finally {
            if (page) {
                await page.close();
            }
        }
    }
}
