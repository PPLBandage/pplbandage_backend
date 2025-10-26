import {
    AccessRoles,
    Bandage,
    BandageModeration,
    Minecraft,
    Tags,
    User,
    UserSettings
} from '@prisma/client';
import { Request } from 'express';

export interface EncodedResponse {
    timestamp: number;
    profileId: string;
    profileName: string;
    textures: {
        SKIN?: {
            url: string;
            metadata?: {
                model: string;
            };
        };
        CAPE?: {
            url: string;
        };
    };
}

export interface Profile {
    id: string;
    name: string;
    properties: {
        name: string;
        value: string;
    }[];
}

export interface SearchUnit {
    name: string;
    uuid: string;
    head: string;
}

export interface SearchParams {
    fragment: string;
    take: number;
    page: number;
}

export interface Notifications {
    id?: number;
    content: string;
    author?: string;
    type?: number;
    creation_date?: Date;
}

export interface SessionToken {
    userId: number;
    access: number;
    iat: number;
    exp: number;
}

export interface Session {
    sessionId: string;
    cookie: string;
    user: UserFull;
}

export interface UserFull extends User {
    profile: Minecraft | null;
    UserSettings: UserSettings | null;
    Bandage: Bandage[];
    stars: Bandage[];
    notifications: Notifications[];
    AccessRoles: AccessRoles[];
    subscribers: User[];
    subscriptions: User[];
}

export interface UserAccess extends User {
    AccessRoles: AccessRoles[];
}

export interface RequestSession extends Request {
    session: Session;
}

export interface RequestSessionWeak extends Request {
    session?: Session;
}

export interface UserAuthor extends User {
    UserSettings: UserSettings | null;
}

export interface BandageModerationIssuer extends BandageModeration {
    issuer: User;
}

export interface BandageFull extends Bandage {
    User: UserAuthor;
    stars: User[];
    tags: Tags[];
    BandageModeration: BandageModerationIssuer | null;
}
