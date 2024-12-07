interface Textures {
    SKIN: {
        url: string;
        metadata?: {
            model: string;
        }
    };
    CAPE?: {
        url: string;
    };
}

interface EncodedResponse {
    timestamp: number,
    profileId: string,
    profileName: string,
    textures: Textures
}

interface Properties {
    name: string;
    value: string;
}

interface Profile {
    id: string;
    name: string;
    properties: Properties[];
}

interface SearchUnit {
    name: string,
    uuid: string,
    head: string
}

interface SearchParams {
    fragment: string,
    take: number,
    page: number
}

interface SkinAndCape {
    skin: {
        data: string,
        slim: boolean
    },
    cape: string
}

interface CapeResponse {
    data: SkinAndCape
}

interface Notifications {
    id?: number,
    content: string,
    author?: string,
    type?: number,
    creation_date?: Date
}
