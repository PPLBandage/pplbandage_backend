interface EncodedResponse {
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

interface Profile {
    id: string;
    name: string;
    properties: {
        name: string;
        value: string;
    }[];
}

interface SearchUnit {
    name: string;
    uuid: string;
    head: string;
}

interface SearchParams {
    fragment: string;
    take: number;
    page: number;
}

interface Notifications {
    id?: number;
    content: string;
    author?: string;
    type?: number;
    creation_date?: Date;
}
