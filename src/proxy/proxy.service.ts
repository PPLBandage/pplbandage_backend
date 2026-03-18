import { Injectable, Logger } from '@nestjs/common';
import axios, { Method } from 'axios';

@Injectable()
export class ProxyService {
    private readonly logger = new Logger(ProxyService.name);

    private fromBase64(str: string) {
        const binary = atob(str);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    private decodePayload(bytes: AllowSharedBufferSource) {
        const json = new TextDecoder().decode(bytes);
        const parsed = JSON.parse(json);

        return {
            ts: parsed.ts,
            data: this.fromBase64(parsed.data)
        };
    }

    private async decryptPacked(base64: string, password: string) {
        const data = this.fromBase64(base64);

        const salt = data.slice(0, 16);
        const iv = data.slice(16, 28);
        const ciphertext = data.slice(28);

        const key = await this.deriveKey(password, salt);

        const decrypted = new Uint8Array(
            await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                ciphertext
            )
        );

        const payload = this.decodePayload(decrypted);

        if (Date.now() - payload.ts > 30_000) {
            throw new Error('Replay attack detected / expired');
        }

        return payload.data;
    }

    private async deriveKey(password: string, salt: BufferSource) {
        const enc = new TextEncoder();

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async makeRequest(
        url: string,
        method: Method,
        body?: unknown,
        headers?: Record<string, string>
    ): Promise<{ data: Uint8Array<ArrayBufferLike>; status: number }> {
        this.logger.log(`Start proxy work on ${url}`);
        const response = await axios.post(
            process.env.PROXY_URL!,
            {
                url,
                method,
                headers,
                body
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PROXY_PASSWORD}`
                },
                validateStatus: () => true
            }
        );

        this.logger.log(`Proxy for ${url} successfully got encrypted data`);
        return {
            data: await this.decryptPacked(
                response.data.data,
                process.env.PROXY_PASSWORD!
            ),
            status: response.data.status || response.status
        };
    }

    getJSON(data: Uint8Array): unknown {
        return JSON.parse(new TextDecoder().decode(data));
    }
}
