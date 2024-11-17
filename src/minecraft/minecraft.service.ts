import axios from "axios";
import * as sharp from 'sharp';
import { PrismaService } from "../prisma/prisma.service";
import { Injectable } from '@nestjs/common';
import { Buffer } from "buffer";
import { Session } from "src/auth/auth.service";

@Injectable()
export class MinecraftService {
    constructor(private prisma: PrismaService) { }

    async getUserData(str: string): Promise<Profile | null> {
        /* get user profile by nickname an UUID (this function duplicate function below, idk) */

        const regexp = new RegExp('^[0-9a-fA-F]{32}$');
        let uuid = str.replace('-', '');
        if (!regexp.test(uuid)) {
            const response_uuid = await axios.get(
                `https://api.mojang.com/users/profiles/minecraft/${uuid}`,
                { validateStatus: () => true }
            );
            if (!response_uuid || response_uuid?.status !== 200) {
                return null;
            }
            uuid = response_uuid.data.id;
        }
        const response_skin = await axios.get(
            `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`,
            { validateStatus: () => true }
        );
        if (!response_skin || response_skin?.status !== 200) {
            return null;
        }
        return response_skin.data;
    }


    async getUUID(str: string): Promise<string | null> {
        /* get UUID by nickname or validate existing */

        const regexp = new RegExp('^[0-9a-fA-F]{32}$');
        let uuid = str.replace('-', '');
        if (!regexp.test(uuid)) {
            const response_uuid = await axios.get(
                `https://api.mojang.com/users/profiles/minecraft/${uuid}`,
                { validateStatus: () => true }
            );
            if (!response_uuid || response_uuid?.status !== 200) {
                return null;
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

        const uuid = await this.getUUID(nickname);  // validate UUID (resolve UUID by nickname also)
        if (!uuid) {
            return null;
        }

        const cache = await this.prisma.minecraft.findFirst({ where: { uuid: uuid } });  // get cache if exists
        if (cache && cache.expires > new Date().getTime() && !ignore_cache) {
            return cache;
        }

        const fetched_skin_data = await this.getUserData(uuid);  // fetch new skin data
        if (!fetched_skin_data) {
            return null;
        }

        if (cache && cache?.default_nick !== fetched_skin_data.name) {
            // if the nickname has been changed since the last caching

            await this.prisma.minecraft.update({
                where: { uuid: fetched_skin_data.id },
                data: {
                    default_nick: fetched_skin_data.name,
                    nickname: fetched_skin_data.name.toLowerCase()
                }
            })
        }

        const profiles = await this.prisma.minecraft.findMany({ where: { nickname: fetched_skin_data?.name.toLowerCase() } });
        if (profiles.length > 1) {
            /* -- resolve nicknames collision --
            Since the cache of skins and nicknames is not deleted after they expire,
            there is a possibility that Minecraft accounts will be occupied by other
            nicknames and there will be a name collision in the database
            */

            await this.resolveCollisions(profiles);
        }

        const textures = Buffer.from(fetched_skin_data.properties[0].value, 'base64').toString();
        const json_textures = JSON.parse(textures) as EncodedResponse;
        const skin_response = await axios.get(json_textures.textures.SKIN.url, { responseType: 'arraybuffer' });
        const skin_buff = Buffer.from(skin_response.data, 'binary');
        const head = await this.generateHead(skin_buff);

        let cape_b64 = '';
        if (json_textures.textures.CAPE) {
            const cape_response = await axios.get(json_textures.textures.CAPE.url, { responseType: 'arraybuffer' });
            cape_b64 = Buffer.from(cape_response.data, 'binary').toString('base64');
        }
        const updated_data = await this.prisma.minecraft.upsert({
            where: { uuid: fetched_skin_data.id },
            create: {
                uuid: fetched_skin_data.id,
                nickname: fetched_skin_data.name.toLowerCase(),
                default_nick: fetched_skin_data.name,
                expires: new Date().getTime() + parseInt(process.env.TTL as string),
                data: skin_buff.toString('base64'),
                data_cape: cape_b64,
                data_head: head.toString('base64'),
                slim: json_textures.textures.SKIN.metadata?.model === 'slim'
            },
            update: {
                nickname: fetched_skin_data.name.toLowerCase(),
                default_nick: fetched_skin_data.name,
                expires: new Date().getTime() + parseInt(process.env.TTL as string),
                data: skin_buff.toString('base64'),
                data_cape: cape_b64,
                data_head: head.toString('base64'),
                slim: json_textures.textures.SKIN.metadata?.model === 'slim'
            }
        });
        return updated_data;
    }


    async searchNicks({ fragment, take, page }: SearchParams): Promise<Search | null> {
        /* search nicks in data base by provided fragment */

        if (fragment.length < 3) {
            return null;
        }
        const filter_rule = { OR: [{ nickname: { contains: fragment } }], valid: true };
        const cache = await this.prisma.minecraft.findMany({
            where: filter_rule,
            orderBy: { default_nick: "asc" },
            take: take, skip: take * page
        });
        if (!cache || cache.length === 0) {
            return null;
        }
        const count: number = await this.prisma.minecraft.count({ where: filter_rule });
        const records_list: SearchUnit[] = cache.map(nick => ({ name: nick.default_nick, uuid: nick.uuid, head: nick.data_head }));
        if (!count) {
            return null;
        }
        return {
            statusCode: 200,
            requestedFragment: fragment,
            data: records_list,
            total_count: count,
            next_page: page + 1
        };
    }


    async changeValid(session: Session, state: boolean) {
        /* switch displaying nick in search */

        const minecraft = await this.prisma.minecraft.findFirst({ where: { userId: session.user.id } });

        if (!minecraft) return {
            statusCode: 400,
            message: 'Minecraft account not connected',
            message_ru: 'Аккаунт Minecraft не привязан'
        };

        const result = await this.prisma.minecraft.update({
            where: { id: minecraft.id },
            data: { valid: state }
        })
        return { statusCode: 200, new_data: result.valid };
    }

    async connect(session: Session, code: string) {
        /* connect minecraft account to a user profile */

        if (session.user.profile) {
            return {
                statusCode: 400,
                message: 'Account already connected',
                message_ru: 'Аккаунт уже подключен'
            };
        }

        const user_data = await axios.get(`https://mc-oauth.andcool.ru/code/${code}`, { validateStatus: () => true });
        if (user_data.status !== 200) {
            return {
                statusCode: 404,
                message: 'Code not found',
                message_ru: 'Код не найден'
            };
        }

        const data = user_data.data as { nickname: string, UUID: string };
        const skin_data = await this.updateSkinCache(data.UUID, true);

        if (!skin_data) {
            return {
                statusCode: 500,
                message: 'Error while finding player data',
                message_ru: 'Не удалось найти и обновить данные о игроке'
            };
        }
        if (skin_data.userId) {
            return {
                statusCode: 409,
                message: 'This account already connected',
                message_ru: 'Этот аккаунт уже подключен к другой учётной записи'
            };
        }

        await this.prisma.user.update({
            where: { id: session.user.id },
            data: { profile: { connect: { id: skin_data.id } } }
        });

        return {
            statusCode: 200,
            message: 'Success',
            message_ru: 'Аккаунт успешно подключен!',
            uuid: skin_data.uuid
        }
    }

    async disconnect(session: Session) {
        /* disconnect minecraft account */

        if (!session.user.profile) {
            return {
                statusCode: 400,
                message: 'Account didn\'t connected',
                message_ru: 'Аккаунт Minecraft не подключен'
            }
        }

        await this.prisma.user.update({
            where: { id: session.user.id },
            data: { profile: { disconnect: { id: session.user.profile.id } } }
        });

        return {
            statusCode: 200,
            message: 'Success',
            message_ru: 'Аккаунт успешно отключен',
        }
    }
}