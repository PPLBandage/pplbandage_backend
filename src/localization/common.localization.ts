export const accept_languages = ['ru', 'en'];

const responses = {
    INTERNAL_ERROR: {
        en: 'Internal server error. Please report it on Telegram https://t.me/andcool_systems',
        ru: 'Внутренняя ошибка сервера. Пожалуйста, сообщите о ней в Telegram https://t.me/andcool_systems'
    },
    UNAUTHORIZED: {
        en: 'Unauthorized',
        ru: 'Неавторизован'
    },
    FORBIDDEN: {
        en: 'Forbidden',
        ru: 'Доступ запрещен'
    },
    INVALID_BODY: {
        en: 'Invalid Body',
        ru: 'Неправильное тело запроса'
    }
};

export default responses;
