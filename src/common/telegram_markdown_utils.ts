export const escapeMd = (text: string) => {
    return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, c => `\\${c}`);
};

export const makeLink = (text: string, link: string) =>
    `[${escapeMd(text)}](${escapeMd(link)})`;
