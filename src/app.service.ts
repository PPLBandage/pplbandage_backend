interface Bandage {
    /* bandage interface */
    User: {
        id: number;
        username: string;
        name: string;
        discordId: string;
        admin: boolean;
        banned: boolean;
        joined_at: Date;
    } | null;
    stars: {
        id: number;
        username: string;
        name: string;
        discordId: string;
        admin: boolean;
        banned: boolean;
        joined_at: Date;
    }[];
    categories: {
        id: number,
        name: string,
        icon: string
    }[];
    id: number,
    externalId: string,
    title: string,
    description: string | null,
    base64: string,
    creationDate: Date
}

export const generate_response = (data: Bandage[], session: Session | null) => {
    /* generate list of works response by provided array of bandages */

    const result = data.map((el) => {
        if (el.User?.banned) return undefined;
        const categories = el.categories.map((cat) => {
            return {
                id: cat.id,
                name: cat.name,
                icon: cat.icon
            }
        })
        return {
            id: el.id,
            external_id: el.externalId,
            title: el.title,
            description: el.description,
            base64: el.base64,
            creation_date: el.creationDate,
            stars_count: el.stars.length,
            starred: Object.values(el.stars).some(val => val.id == session?.user.id),
            author: {
                id: el.User?.id,
                name: el.User?.name,
                username: el.User?.username
            },
            categories: categories.filter((el) => el !== undefined)
        }
    });

    return result.filter((el) => el !== undefined);
}