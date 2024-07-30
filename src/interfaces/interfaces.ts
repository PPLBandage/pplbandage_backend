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
    profileActions: any[];
}

interface DefaultResponse {
    message: string;
}

interface Cache {
    id: number;
    uuid: string;
    data: string;
    data_cape: string;
    data_head: string;
    nickname: string;
    expires: bigint;
    default_nick: string;
    valid: boolean;
}

interface SearchUnit {
    name: string,
    uuid: string,
    head: string
}

interface Search {
    status: string,
    requestedFragment: string
    data: SearchUnit[],
    total_count: number,
    next_page: number
}

interface SearchQuery {
    take?: string,
    page?: string,
    search?: string,
    for_edit?: string,
    filters?: string,
    sort?: string,
    state?: string
}

interface SearchParams {
    fragment: string,
    take: number,
    page: number
}


interface TexturesProfile {
    SKIN: TextureProfile;
    CAPE?: TextureProfile;
}

interface TextureProfile {
    mojang: string | undefined;
    eldraxis: string;
}

interface EldraxisCache {
    available_in_search: boolean,
    last_cached: number
}

interface ProfileResponse {
    message: string,
    timestamp: number,
    uuid: string,
    nickname: string,
    textures: TexturesProfile,
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

interface User {
    id: number;
    username: string;
    name: string;
    discordId: string;
    admin: boolean;
    banned: boolean;
    joined_at: Date;
    profile: {
        id: number;
        uuid: string;
        data: string;
        data_cape: string;
        data_head: string;
        nickname: string;
        expires: bigint;
        default_nick: string;
        valid: boolean;
        userId: number | null;
    } | null;
    autoload: boolean;
    notifications: Notifications[];
}

interface Session {
    sessionId: string;
    cookie: string;
    user: User;
}

interface CreateBody {
    base64: string,
    base64_slim?: string,
    title: string,
    description: string,
    categories: number[],
    access_level: number,
    split_type?: boolean
}

interface RequestSession extends Request {
    session: Session
}