import axios from 'axios';
import * as sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { HttpException, Injectable } from '@nestjs/common';
import { Buffer } from 'buffer';
import { Session } from 'src/auth/auth.service';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses from 'src/localization/minecraft.localization';

@Injectable()
export class MinecraftService {
    constructor(private prisma: PrismaService) {}

    async getUserData(uuid: string): Promise<Profile> {
        /* get user profile by UUID */

        const response_skin = await axios.get(
            `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`,
            { validateStatus: () => true }
        );
        if (response_skin.status !== 200) {
            if (response_skin.status === 204)
                throw new LocaleException(responses.PROFILE_NOT_FOUND, 404);

            throw new LocaleException(
                responses.MOJANG_ERROR,
                response_skin.status
            );
        }
        return response_skin.data;
    }

    async getUUID(str: string): Promise<string> {
        /* get UUID by nickname or validate existing */

        const regexp = new RegExp('^[0-9a-fA-F]{32}$');
        let uuid = str.replace('-', '');
        if (!regexp.test(uuid)) {
            const response_uuid = await axios.get(
                `https://api.mojang.com/users/profiles/minecraft/${uuid}`,
                { validateStatus: () => true }
            );
            if (response_uuid.status !== 200) {
                throw new LocaleException(
                    response_uuid.status === 404
                        ? responses.PROFILE_NOT_FOUND
                        : responses.MOJANG_ERROR,
                    response_uuid.status
                );
            }
            uuid = response_uuid.data.id;
        }
        return uuid;
    }

    async generateHead(skinBuffer: Buffer): Promise<Buffer> {
        /* generate head from buffer */

        const head = sharp({
            create: {
                width: 36,
                height: 36,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        }).png();

        const firstLayer = await sharp(skinBuffer)
            .extract({ left: 8, top: 8, width: 8, height: 8 })
            .resize(32, 32, { kernel: sharp.kernel.nearest })
            .png()
            .toBuffer();

        const secondLayer = await sharp(skinBuffer)
            .extract({ left: 40, top: 8, width: 8, height: 8 })
            .resize(36, 36, { kernel: sharp.kernel.nearest })
            .png()
            .toBuffer();
        head.composite([
            { input: firstLayer, top: 2, left: 2, blend: 'over' },
            { input: secondLayer, top: 0, left: 0, blend: 'over' }
        ]);

        return await head.toBuffer();
    }

    async resolveCollisions(profiles: { uuid: string }[]) {
        /* resolve nicknames collisions in data base */

        for (const record of profiles) {
            const data = await this.getUserData(record.uuid);
            if (!data) {
                continue;
            }

            await this.prisma.minecraft.update({
                where: { uuid: data.id },
                data: {
                    default_nick: data.name,
                    nickname: data.name.toLowerCase()
                }
            });
        }
    }

    async updateSkinCache(nickname: string, ignore_cache: boolean = false) {
        /* update skin data in data base */

        const uuid = await this.getUUID(nickname); // validate UUID (resolve UUID by nickname also)
        const cache = await this.prisma.minecraft.findFirst({
            where: { uuid: uuid }
        }); // get cache if exists

        if (cache && cache.expires > new Date().getTime() && !ignore_cache) {
            return cache;
        }

        const fetched_skin_data = await this.getUserData(uuid); // fetch new skin data
        if (cache && cache.default_nick !== fetched_skin_data.name) {
            // if the nickname has been changed since the last caching

            await this.prisma.minecraft.update({
                where: { uuid: fetched_skin_data.id },
                data: {
                    default_nick: fetched_skin_data.name,
                    nickname: fetched_skin_data.name.toLowerCase()
                }
            });
        }

        const profiles = await this.prisma.minecraft.findMany({
            where: { nickname: fetched_skin_data.name.toLowerCase() }
        });
        if (profiles.length > 1) {
            /* -- resolve nicknames collision --
            Since the cache of skins and nicknames is not deleted after they expire,
            there is a possibility that Minecraft accounts will be occupied by other
            nicknames and there will be a name collision in the database
            */

            await this.resolveCollisions(profiles);
        }

        const properties = fetched_skin_data.properties.find(
            obj => obj.name === 'textures'
        );
        if (!properties)
            throw new LocaleException(responses.PROFILE_NOT_FOUND, 404);

        const textures = Buffer.from(properties.value, 'base64').toString();
        const json_textures = JSON.parse(textures) as EncodedResponse;

        let skin_buff: Buffer | null = null;
        if (json_textures.textures.SKIN) {
            const skin_response = await axios.get(
                json_textures.textures.SKIN.url,
                { responseType: 'arraybuffer', validateStatus: () => true }
            );

            if (skin_response.status !== 200) {
                throw new LocaleException(
                    skin_response.status === 404
                        ? responses.PROFILE_NOT_FOUND
                        : responses.MOJANG_ERROR,
                    skin_response.status
                );
            }
            skin_buff = Buffer.from(skin_response.data, 'binary');
        } else {
            skin_buff = await sharp('./src/minecraft/steve.png').toBuffer();
        }

        const head = await this.generateHead(skin_buff);

        let cape_b64 = '';
        if (json_textures.textures.CAPE) {
            const cape_response = await axios.get(
                json_textures.textures.CAPE.url,
                { responseType: 'arraybuffer', validateStatus: () => true }
            );
            if (cape_response.status === 200) {
                cape_b64 = Buffer.from(cape_response.data, 'binary').toString(
                    'base64'
                );
            }
        }

        const update_data = {
            nickname: fetched_skin_data.name.toLowerCase(),
            default_nick: fetched_skin_data.name,
            expires: new Date().getTime() + parseInt(process.env.TTL as string),
            data: skin_buff.toString('base64'),
            data_cape: cape_b64,
            data_head: head.toString('base64'),
            slim: json_textures.textures.SKIN?.metadata?.model === 'slim'
        };

        const updated_data = await this.prisma.minecraft.upsert({
            where: { uuid: fetched_skin_data.id },
            create: {
                uuid: fetched_skin_data.id,
                ...update_data
            },
            update: update_data
        });
        return updated_data;
    }

    async revalidateSkins(count: number) {
        const skins_for_revalidate = await this.prisma.minecraft.findMany({
            orderBy: { expires: 'asc' },
            take: count
        });

        for (const skin of skins_for_revalidate) {
            try {
                await this.updateSkinCache(skin.uuid, true);
                //console.log(`Revalidated cache for ${skin.default_nick}`);
            } catch (e: LocaleException | unknown) {
                let cause = e;
                if (e instanceof LocaleException) {
                    cause = JSON.stringify(e.getResponse());
                }
                console.error(
                    `Cannot revalidate skin cache for ${skin.default_nick}! Cause: ${cause}`
                );
            }
        }

        console.info(
            `Finished revalidating ${skins_for_revalidate.length} skins`
        );
    }

    async searchNicks({ fragment, take, page }: SearchParams) {
        /* search nicks in data base by provided fragment */

        if (fragment.length < 3) throw new HttpException('', 204);

        const filter_rule = {
            OR: [{ nickname: { contains: fragment } }],
            valid: true
        };
        const cache = await this.prisma.minecraft.findMany({
            where: filter_rule,
            orderBy: { default_nick: 'asc' },
            take,
            skip: take * page
        });

        if (cache.length === 0) throw new HttpException('', 204);

        const count = await this.prisma.minecraft.count({
            where: filter_rule
        });

        const records_list = cache.map(nick => ({
            name: nick.default_nick,
            uuid: nick.uuid,
            head: nick.data_head
        }));

        if (!count) throw new HttpException('', 204);

        return {
            requested_fragment: fragment,
            data: records_list,
            total_count: count,
            next_page: page + 1
        };
    }

    async getByCode(code: string): Promise<{ nickname: string; UUID: string }> {
        /* Resolve mc-oauth code */

        const response = await axios.get(
            `${process.env.MC_OAUTH_API}/${code}`,
            { validateStatus: () => true }
        );
        if (response.status !== 200)
            throw new LocaleException(responses.CODE_NOT_FOUND, 404);

        return response.data as { nickname: string; UUID: string };
    }

    async connect(session: Session, code: string) {
        /* connect minecraft account to a user profile */

        if (session.user.profile)
            throw new LocaleException(responses.ALREADY_CONNECTED, 409);

        const data = await this.getByCode(code);
        const skin_data = await this.updateSkinCache(data.UUID, true);

        if (skin_data.userId)
            throw new LocaleException(responses.ANOTHER_ALREADY_CONNECTED, 409);

        await this.prisma.user.update({
            where: { id: session.user.id },
            data: { profile: { connect: { id: skin_data.id } } }
        });

        return { uuid: skin_data.uuid };
    }

    async disconnect(session: Session) {
        /* disconnect minecraft account */

        if (!session.user.profile)
            throw new LocaleException(responses.ACCOUNT_NOT_CONNECTED, 404);

        await this.prisma.user.update({
            where: { id: session.user.id },
            data: { profile: { disconnect: { id: session.user.profile.id } } }
        });
    }

    async generateSvg(image: sharp.Sharp, pixelWidth: number): Promise<string> {
        const { data, info } = await image
            .raw()
            .ensureAlpha()
            .toBuffer({ resolveWithObject: true });

        const coef = 7 / 8;

        const drawRect = (
            x: number,
            y: number,
            pixelIndex: number,
            width: number,
            height: number,
            offsetX = 0,
            offsetY = 0,
            scale = 1
        ) => {
            const r = data[pixelIndex];
            const g = data[pixelIndex + 1];
            const b = data[pixelIndex + 2];
            const a = data[pixelIndex + 3] / 255;

            if (a === 0) return '';

            const posX = offsetX + x * pixelWidth * scale;
            const posY = offsetY + y * pixelWidth * scale;
            const w = width * scale;
            const h = height * scale;

            return `<rect x="${posX}" y="${posY}" width="${w}" height="${h}" fill="rgba(${r}, ${g}, ${b}, ${a})" />`;
        };

        const pixels: string[] = [];

        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                const imgX = x + 8;
                const imgY = y + 8;
                const pixelIndex = (imgY * info.width + imgX) * info.channels;

                const rect = drawRect(
                    x,
                    y,
                    pixelIndex,
                    pixelWidth + 1,
                    pixelWidth + 1,
                    pixelWidth / 2,
                    pixelWidth / 2,
                    coef
                );

                if (rect) pixels.push(rect);
            }
        }

        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                const imgX = x + 40;
                const imgY = y + 8;
                const pixelIndex = (imgY * info.width + imgX) * info.channels;

                const rect = drawRect(x, y, pixelIndex, pixelWidth, pixelWidth);
                if (rect) pixels.push(rect);
            }
        }

        const svgWidth = pixelWidth * 8;
        const svgHeight = pixelWidth * 8;

        return [
            `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`,
            ...pixels,
            `</svg>`
        ].join('\n');
    }
}
