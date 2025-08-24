export interface GQLResponse {
    data: {
        emotes: {
            items: Items[];
        };
    } | null;
}

export interface Items {
    id: string;
    name: string;
    host: {
        url: string;
    };
}
