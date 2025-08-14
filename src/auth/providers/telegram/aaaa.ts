/*

import { Controller, Get, Post, Req, Res, Logger, Query } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { SessionService } from '../session.service';
import { Providers } from '@prisma/client';

interface TelegramCallbackBody {
    tgAuthResult: string;
}

@Controller('auth')
export class TelegramAuthController {
    private readonly BOT_DOMAIN = 'http://192.168.0.17:4000';
    private readonly BOT_TOKEN = 'o';
    private readonly BOT_USERNAME = '8464147040';
    private readonly logger = new Logger(TelegramAuthController.name);

    constructor(private readonly session: SessionService) {}

    @Get('telegram')
    telegramAuth(@Res() res: Response) {
        const redirectUrl = `https://oauth.telegram.org/auth?bot_id=${this.BOT_USERNAME}&origin=${this.BOT_DOMAIN}&return_to=${this.BOT_DOMAIN}/api/auth/telegram/callback&request_access=write`;

        this.logger.log(`Redirecting to Telegram: \n${redirectUrl}`);
        res.redirect(redirectUrl);
    }

    @Get('telegram/callback')
    telegramCallbackGet(@Res() res: Response) {
        this.logger.log('callback');
        res.send(`
      <!DOCTYPE html>
      <html>
        <body>
          <script>
            const fragment = window.location.hash.substring(1);
            const params = new URLSearchParams(fragment);
            const tgAuthResult = params.get('tgAuthResult');
            
            if (!tgAuthResult) {
              window.location.href = 'http://localhost:3000?error=no_auth_data';
              exit;
            }
            
            fetch('/api/auth/telegram/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tgAuthResult })
            })
            .then(response => {
              if (response.ok) {
                response.json().then(data => {
                  window.location.href = '${this.BOT_DOMAIN}/api/auth/setToken'+'?'+'token='+data.token
                });
              } else {
                throw new Error('Auth failed');
              }
            })
            .catch(error => {
              console.error('Auth error:', error);
              window.location.href = 'http://localhost:3000?error=auth_failed';
            });
          </script>
        </body>
      </html>
    `);
    }

    @Post('telegram/callback')
    async telegramCallbackPost(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response
    ) {
        this.logger.log('Успешный запрос');
        this.logger.log(req.body);
        try {
            const body = req.body as TelegramCallbackBody;
            const { tgAuthResult } = body;

            if (!tgAuthResult) {
                this.logger.error('Missing tgAuthResult in request body');
                return res.status(400).send('Invalid request');
            }

            type userDataType = {
                id: number;
                first_name: string;
                username: string;
                photo_url: string;
                auth_date: number;
                hash: string;
            };
            let userData: userDataType;
            try {
                const decoded = Buffer.from(tgAuthResult, 'base64').toString(
                    'utf8'
                );
                userData = JSON.parse(decoded) as userDataType;
                this.logger.log(userData);
            } catch (e) {
                this.logger.error('Failed to parse tgAuthResult', e);
                return res.status(400).send('Invalid auth data');
            }

            if (!userData.hash || !userData.auth_date) {
                this.logger.error('Missing required fields in auth data');
                return res.status(400).send('Invalid auth data');
            }

            const dataCheckString = (
                Object.keys(userData) as Array<keyof userDataType>
            )
                .filter(
                    (k): k is Exclude<keyof userDataType, 'hash'> =>
                        k !== 'hash'
                )
                .sort()
                .map(k => `${k}=${userData[k]}`)
                .join('\n');

            const secretKey = crypto
                .createHash('sha256')
                .update(this.BOT_TOKEN)
                .digest();

            const hmac = crypto
                .createHmac('sha256', secretKey)
                .update(dataCheckString)
                .digest('hex');

            console.log(userData.hash);
            console.log(hmac);

            if (hmac !== userData.hash) {
                this.logger.error('Invalid signature', {
                    received: userData.hash,
                    calculated: hmac
                });
                return res.status(401).send('Invalid signature');
            }

            const authDate = parseInt(String(userData.auth_date), 10);
            const now = Math.floor(Date.now() / 1000);
            if (now - authDate > 86400) {
                // 24 часа
                this.logger.error('Expired auth data', { authDate, now });
                return res.status(401).send('Expired auth data');
            }

            this.logger.log('Successfully authenticated user', {
                id: userData.id,
                username: userData.username
            });

            const session = await this.session.findOrCreate(
                Providers.Telegram,
                String(userData.id)
            );

            console.log(session);

            res.status(200).send({ token: session.sessionToken });
        } catch (error) {
            this.logger.error('Callback processing error', error);
            res.status(500).send('Internal Server Error');
        }
    }

    @Get('setToken')
    test(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Query('token') token: string
    ) {
        this.logger.log(token);
        this.logger.log(req.cookies);

        res.cookie('sessionToken', token, {
            maxAge: 1000 * 60 * 60 * 24 * 30 * 2,
            httpOnly: true
        });
        res.redirect('http://192.168.0.17/profile');
    }
}
*/
