import type { Request } from 'express';
import {
    Bandage,
    BandageModeration,
    Tags,
    User,
    UserSettings
} from '@prisma/client';
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

interface BandageModerationIssuer extends BandageModeration {
    issuer: User;
}

export interface BandageFull extends Bandage {
    User: UserAuthor;
    stars: User[];
    tags: Tags[];
    BandageModeration: BandageModerationIssuer | null;
}

export const generateFlags = (el: BandageFull, session?: Session) => {
    const starred = el.stars.some(val => val.id === session?.user.id);

    /*
    0 - colorable
    1 - split_type
    2 - starred (НЕ БЕЙТЕ)
    3 - under_moderation
    4 - denied
    */

    let flags = Number(el.colorable);
    flags |= Number(el.split_type) << 1;
    flags |= Number(starred) << 2;
    flags |= Number(el.BandageModeration?.type === 'review') << 3;
    flags |= Number(el.BandageModeration?.type === 'denied') << 4;

    return flags;
};

export const generateModerationState = (el: BandageFull) => {
    if (!el.BandageModeration) return null;

    const bandage_moderation = el.BandageModeration;
    return {
        type: bandage_moderation.type,
        message: bandage_moderation.message,
        is_hides: bandage_moderation.is_hides,
        issuer: {
            id: bandage_moderation.issuer.id,
            name: bandage_moderation.issuer.name,
            username: bandage_moderation.issuer.username
        }
    };
};

export const generateResponse = (
    data: BandageFull[],
    session?: Session,
    suppress_ban?: boolean
) => {
    /* generate list of works response by provided array of bandages */

    const result = data.map(el => {
        if (el.User?.UserSettings?.banned && !suppress_ban) return undefined;
        if (
            el.BandageModeration &&
            el.BandageModeration?.is_hides &&
            !suppress_ban
        )
            return undefined;

        return {
            id: el.id,
            external_id: el.externalId,
            title: el.title,
            description: el.description,
            base64: el.base64,
            flags: generateFlags(el, session),
            accent_color: el.accent_color,
            creation_date: el.creationDate,
            stars_count: el.stars.length,
            tags: el.tags.map(tag => tag.name),
            author: {
                id: el.User.id,
                name: el.User.reserved_name || el.User.name,
                username: el.User.username,
                public: el.User.UserSettings?.public_profile
            },
            access_level: el.access_level,
            star_type: el.star_type,
            moderation: generateModerationState(el)
        };
    });

    return result.filter(el => el !== undefined);
};
