import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getColorFromURL, getPaletteFromURL, Palette } from 'color-thief-node';
import { colorable } from 'src/constants';
import { Session } from 'src/auth/auth.service';
import { getHue } from './color_utils';
import { rgbToHex } from './bandage.service';
import * as sharp from 'sharp';

export interface HueBandage {
    hue: number,
    accuracy?: number,
    nearest_color?: string;
}

const maskImage = sharp('./src/workshop/mask.png');

@Injectable()
export class RecommendationsService {
    constructor(private prisma: PrismaService) { }

    async getSkinColors(base64: string, count: number): Promise<Palette[]> {
        const mask = await maskImage.toBuffer();
        const buff = await sharp(Buffer.from(base64, 'base64'))
            .composite([{ input: mask, blend: 'dest-in' }])
            .toBuffer();
        return await getPaletteFromURL(`data:image/png;base64,${buff.toString('base64')}`, count);
    }

    async calculateBandagesColor(session: Session) {
        const bandages = await this.prisma.bandage.findMany({
            where: {
                access_level: 2,
                AND: [
                    { categories: { none: { only_admins: true } } },
                    { categories: { none: { id: colorable } } }
                ],
                User: { UserSettings: { banned: false } }
            },
            include: { User: { include: { UserSettings: true } }, stars: true, categories: true }
        });

        return Promise.all(bandages.map(async bandage => {
            const categories = bandage.categories.map(cat => ({ id: cat.id, name: cat.name, icon: cat.icon, colorable: cat.colorable }));
            const [r, g, b] = await getColorFromURL(`data:image/png;base64,${bandage.base64}`);
            return {
                id: bandage.id,
                external_id: bandage.externalId,
                title: bandage.title,
                description: bandage.description,
                base64: bandage.base64,
                split_type: bandage.split_type,
                accent_color: bandage.accent_color,
                creation_date: bandage.creationDate,
                stars_count: bandage.stars.length,
                starred: bandage.stars.some(val => val.id == session?.user.id),
                author: {
                    id: bandage.User?.id,
                    name: bandage.User?.reserved_name || bandage.User?.name,
                    username: bandage.User?.username,
                    public: bandage.User && Number(bandage.User?.discordId) > 0 ? bandage.User?.UserSettings?.public_profile : false
                },
                categories: categories.filter(el => el !== undefined),
                hue: getHue({ r, g, b })
            }
        }));
    }

    getNearestBandages(color: number[], bandages: HueBandage[], tolerance: number) {
        const [r, g, b] = color;
        const hue = getHue({ r, g, b });
        return bandages.reduce((acc: HueBandage[], iter: HueBandage) => {
            const diff = Math.abs(iter.hue - hue);
            const diff_full = Math.min(diff, 360 - diff);
            const accuracy = diff_full <= tolerance;
            if (accuracy) {
                iter.accuracy = (360 - diff_full) / 360;
                iter.nearest_color = rgbToHex(color[0], color[1], color[2]);
                acc.push(iter);
            }
            return acc;
        }, []);
    }

    async getMatchingColors(color: number[], count: number) {
        const [r, g, b] = color;
        let hue = getHue({ r, g, b });
        const step_angle = count > 2 ? (count - 2) * 180 / count : 180;
        const color_array: [number] = [hue];

        for (let i = 0; i < count - 1; i++) {
            hue += step_angle;
            if (hue > 360) hue -= 360;
            color_array.push(hue);
        }

        return color_array;
    }

    async getForMySkin(session: Session) {
        const skin = session.user.profile?.data;
        if (!skin) return {
            statusCode: 404,
            message: 'Skin not connected',
            message_ru: 'Профиль Minecraft не подключен'
        }

        const skin_colors = await this.getSkinColors(skin, 2);
        const bandages = await this.calculateBandagesColor(session);
        let result_bandages: HueBandage[] = [];
        for (const color of skin_colors) {
            result_bandages = result_bandages.concat(this.getNearestBandages(color, bandages, 5))
        }

        return {
            statusCode: 200,
            data: result_bandages.sort((a, b) => (b.accuracy as number) - (a.accuracy as number)),
            skin_accent_colors: skin_colors.map(el => rgbToHex(el[0], el[1], el[2]))
        }
    }
}
