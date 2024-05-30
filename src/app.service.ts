import axios from "axios";
import * as sharp from 'sharp';
import { PrismaService } from "./prisma.service";
import { Buffer } from "buffer";

const prisma = new PrismaService();

export async function getUserData(str: string): Promise<Profile | null> {
    const regexp = new RegExp('^[0-9a-fA-F]{32}$');
    let uuid = str.replace('-', '');
    if (!regexp.test(uuid)) {
        const response_uuid = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${uuid}`, { validateStatus: () => true });
        if (!response_uuid || response_uuid?.status !== 200) {
            return null;
        }
        uuid = response_uuid?.data.id;
    }
    const response_skin = await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, { validateStatus: () => true });
    if (!response_skin || response_skin?.status !== 200) {
        return null;
    }
    return response_skin?.data;
}


export async function getUUID(str: string): Promise<string | null> {
    const regexp = new RegExp('^[0-9a-fA-F]{32}$');
    let uuid = str.replace('-', '');
    if (!regexp.test(uuid)) {
        const response_uuid = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${uuid}`, { validateStatus: () => true });
        if (!response_uuid || response_uuid?.status !== 200) {
            return null;
        }
        uuid = response_uuid?.data.id;
    }
    return uuid;
}


export async function generateHead(skinBuffer: Buffer): Promise<Buffer> {
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
    head.composite([{ input: firstLayer, top: 2, left: 2, blend: 'over' }, { input: secondLayer, top: 0, left: 0, blend: 'over' }]);

    return await head.toBuffer();
}


export async function resolveCollisions(prof: any[]) {
    for (const record of prof) {
        const data = await getUserData(record?.uuid);
        if (!data) {
            continue;
        }

        await prisma.minecraft.update({
            where: { uuid: data.id },
            data: {
                default_nick: data.name,
                nickname: data.name.toLowerCase()
            }
        });
    }
}


export async function updateSkinCache(nickname: string, ignore_cache: boolean = false) {
    const uuid = await getUUID(nickname);
    if (!uuid) {
        return null;
    }

    const cache = await prisma.minecraft.findFirst({ where: { uuid: uuid } });
    if (cache && cache.expires > new Date().getTime() && !ignore_cache) {
        return cache;
    }

    const fetched_skin_data = await getUserData(uuid);
    if (!fetched_skin_data) {
        return null;
    }
    const nicks = await prisma.minecraft.findMany({ where: { default_nick: fetched_skin_data?.name } });
    if (nicks.length > 1) {
        await resolveCollisions(nicks);
    }

    if (cache?.default_nick !== fetched_skin_data.name) {
        await prisma.minecraft.update({
            where: { uuid: fetched_skin_data.id },
            data: {
                default_nick: fetched_skin_data.name,
                nickname: fetched_skin_data.name.toLowerCase()
            }
        })
    }
    const textures = atob(fetched_skin_data.properties[0].value);
    const json_textures = JSON.parse(textures) as EncodedResponse;
    const skin_response = await axios.get(json_textures.textures.SKIN.url, {
        responseType: 'arraybuffer'
    });
    const skin_buff = Buffer.from(skin_response.data, 'binary');
    const head = await generateHead(skin_buff);

    let cape_b64 = "";
    if (json_textures.textures.CAPE) {
        const skin_response = await axios.get(json_textures.textures?.CAPE.url, {
            responseType: 'arraybuffer'
        });
        cape_b64 = Buffer.from(skin_response.data, 'binary').toString("base64");
    }
    const updated_data = await prisma.minecraft.upsert({
        where: { uuid: fetched_skin_data.id },
        create: {
            uuid: fetched_skin_data.id,
            nickname: fetched_skin_data.name.toLowerCase(),
            default_nick: fetched_skin_data.name,
            expires: new Date().getTime() + parseInt(process.env.TTL as string),
            data: skin_buff.toString("base64"),
            data_cape: cape_b64,
            data_head: head.toString("base64")
        },
        update: {
            nickname: fetched_skin_data.name.toLowerCase(),
            default_nick: fetched_skin_data.name,
            expires: new Date().getTime() + parseInt(process.env.TTL as string),
            data: skin_buff.toString("base64"),
            data_cape: cape_b64,
            data_head: head.toString("base64")
        }
    });
    return updated_data;
}


export async function searchNicks({ fragment, take, page }: SearchParams): Promise<Search | null> {
    if (fragment.length < 3) {
        return null;
    }
    const cache = await prisma.minecraft.findMany({
        where: { nickname: { contains: fragment }, valid: true },
        orderBy: { default_nick: "asc" },
        take: take, skip: take * page
    });
    if (!cache) {
        return null;
    }
    const count: number = await prisma.minecraft.count({ where: { nickname: { contains: fragment }, valid: true } });
    const records_list: SearchUnit[] = cache.map((nick) => {
        return { name: nick.default_nick, uuid: nick.uuid, head: nick.data_head };
    });
    if (!count) return null;
    return {
        status: "sucess",
        requestedFragment: fragment,
        data: records_list,
        total_count: count,
        next_page: page + 1
    };
}