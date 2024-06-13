interface Texture {
    url: string;
}

interface Textures {
    SKIN: Texture;
    CAPE?: Texture;
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

interface Cache{
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

interface SearchUnit{
    name: string,
    uuid: string,
    head: string
}

interface Search{
    status: string, 
    requestedFragment: string
    data: SearchUnit[],
    total_count: number,
    next_page: number
}

interface SearchQuery{
    take?: string,
    page?: string,
    search?: string,
    for_edit?: string,
    filters?: string,
    sort?: string,
    state?: string
}

interface SearchParams{
    fragment: string,
    take: number,
    page: number
}


interface TexturesProfile{
    SKIN: TextureProfile;
    CAPE?: TextureProfile;
}

interface TextureProfile{
    mojang: string | undefined;
    eldraxis: string;
}

interface EldraxisCache{
    available_in_search: boolean,
    last_cached: number
}

interface ProfileResponse{
    message: string,
    timestamp: number,
    uuid: string,
    nickname: string,
    textures: TexturesProfile,
}

interface SkinAndCape {
    skin: string,
    cape: string
}

interface CapeResponse {
	message: string,
	data: SkinAndCape
}

interface Session {
    sessionId: string; 
    cookie: string; 
    user_id: number;
}