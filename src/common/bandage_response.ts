import type { Request } from 'express';
import { Bandage, Category, User, UserSettings } from '@prisma/client';
import { Session } from 'src/auth/auth.service';

export interface RequestSession extends Request {
    session: Session;
}

export interface RequestSessionWeak extends Request {
    session?: Session;
}

interface UserAuthor extends User {
    UserSettings: UserSettings | null;
}

export interface BandageFull extends Bandage {
    User: UserAuthor;
    stars: User[];
    categories: Category[];
}

export const generateResponse = (
    data: BandageFull[],
    session: Session | null,
    suppress_ban?: boolean
) => {
    /* generate list of works response by provided array of bandages */

    const result = data.map(el => {
        if (el.User?.UserSettings?.banned && !suppress_ban) return undefined;
        const categories = el.categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            icon: cat.icon,
            colorable: cat.colorable
        }));

        return {
            id: el.id,
            external_id: el.externalId,
            title: el.title,
            description: el.description,
            base64: el.base64,
            split_type: el.split_type,
            accent_color: el.accent_color,
            creation_date: el.creationDate,
            stars_count: el.stars.length,
            starred: !!el.stars.find(val => val.id === session?.user.id),
            author: {
                id: el.User.id,
                name: el.User.reserved_name || el.User.name,
                username: el.User.username,
                public: el.User.UserSettings?.public_profile
            },
            categories: categories,
            access_level: el.access_level,
            star_type: el.star_type
        };
    });

    return result.filter(el => el !== undefined);
};
