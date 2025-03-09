export const accept_languages = ['ru', 'en'];

const responses = {
    INTERNAL_ERROR: {
        en: 'Internal server error',
        ru: 'Внутренняя ошибка сервера'
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
