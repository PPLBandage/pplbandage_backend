const responses = {
    BANDAGE_NOT_FOUND: {
        en: 'Bandage not found',
        ru: 'Повязка не найдена'
    },
    TOO_MANY_BANDAGES: {
        en: 'You cannot create more than 5 bandages under review',
        ru: 'Вы не можете иметь более 5 повязок на проверке, дождитесь проверки остальных и повторите попытку'
    },
    BAD_BANDAGE_SIZE: {
        en: 'Invalid bandage size or format!',
        ru: 'Повязка должна иметь ширину 16 пикселей, высоту от 2 до 24 пикселей и четную высоту'
    },
    BAD_SECOND_BANDAGE_SIZE: {
        en: 'The second bandage should be the same height as the first',
        ru: 'Вторая повязка должна иметь такую ​​же высоту, как и первая'
    },
    ERROR_WHILE_BANDAGE_PROCESSING: {
        en: 'Error while processing base64',
        ru: 'Произошла ошибка при обработке base64'
    }
};

export default responses;
