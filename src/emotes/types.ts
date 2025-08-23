export interface GQLResponse {
    data: {
        emotes: {
            items: {
                id: string;
                name: string;
                host: {
                    url: string;
                };
            }[];
        };
    } | null;
}
