# Пользователи
**API для управления профилями пользователей, настройками, подписками и сессиями.**

---

## Профиль текущего пользователя

### `GET /users/@me`
<sub>Strict Auth required</sub>  
Получить краткие данные текущего пользователя (для главной страницы/дашборда).

### Тело ответа
```json
{
    "userID": "236188357351178344",
    "username": "andcoolsystems",
    "name": "AndcoolSystems",
    "joined_at": "2023-01-15T10:30:00.000Z",
    "banner_color": "#FF5733",
    "profile_theme": 0,
    "has_unreaded_notifications": false,
    "stars_count": 156,
    "subscribers_count": 23,
    "badges": 0
}
```

### Описание полей
| Поле                         | Описание                                    |
| ---------------------------- | ------------------------------------------- |
| `userID`                     | Snowflake ID пользователя                   |
| `username`                   | Username для URL                            |
| `name`                       | Отображаемое имя                            |
| `joined_at`                  | Дата регистрации (ISO 8601)                 |
| `banner_color`               | Цвет баннера/темы (HEX)                     |
| `profile_theme`              | Тема профиля                                |
| `has_unreaded_notifications` | Есть ли непрочитанные уведомления           |
| `stars_count`                | Суммарное количество звезд на всех повязках |
| `subscribers_count`          | Количество подписчиков                      |
| `badges`                     | Битовая маска значков пользователя          |

### Особенности
- Этот эндпоинт возвращает минимальный набор данных для отображения информации на главной странице
- Для получения полных настроек используйте `GET /users/@me/settings`
- `stars_count` - это сумма всех звезд на всех повязках пользователя, а не избранное

---

### `PATCH /users/@me`
<sub>Strict Auth required</sub>  
Обновить настройки текущего пользователя.

### Тело запроса
| Поле                        | Описание                                        | Тип данных | Обязательный | Ограничения           |
| --------------------------- | ----------------------------------------------- | ---------- | :----------: | --------------------- |
| `profile_theme`             | Тема профиля                                    | `number`   |     Нет      | 0-2                   |
| `theme_color`               | Цвет темы профиля                               | `string`   |     Нет      | Формат HEX (#RRGGBB)  |
| `minecraft_skin_autoload`   | Автозагрузка скина Minecraft в мастерской       | `boolean`  |     Нет      | -                     |
| `minecraft_nick_searchable` | Отображение никнейма Minecraft в поиске         | `boolean`  |     Нет      | -                     |
| `public_profile`            | Публичность профиля                             | `boolean`  |     Нет      | -                     |
| `preferred_avatar`          | Предпочитаемый источник аватара                 | `string`   |     Нет      | discord/minecraft/... |
| `minecraft_main_page_skin`  | Использовать скин Minecraft на главной странице | `boolean`  |     Нет      | -                     |

### Особенности
- `theme_color`: должен быть валидный HEX цвет (например, `#FF5733`)
- `preferred_avatar`: должен быть одним из: `discord`, `minecraft`, `google`, `twitch`, `telegram`

---

### `DELETE /users/@me`
<sub>Strict Auth required</sub>  
Выйти из текущей сессии (logout).

> [!NOTE]
> Исторически этот эндпоинт используется для выхода, а не удаления аккаунта. Для удаления используйте `DELETE /users/@me/delete`.

---

### `DELETE /users/@me/delete`
<sub>Strict Auth required</sub>  
Полное удаление аккаунта пользователя.

> [!WARNING]
> Это действие необратимо! Удаляются все данные пользователя, включая повязки, звезды и настройки.

---

## Сессии

### `GET /users/@me/sessions`
<sub>Strict Auth required</sub>  
Получить список всех активных сессий текущего пользователя.

### Тело ответа
```json
[
    {
        "id": 1,
        "last_accessed": "2025-01-15T10:00:00.000Z",
        "is_self": true,
        "is_mobile": false,
        "browser": "Chrome",
        "browser_version": "120.0.0.0"
    },
    {
        "id": 2,
        "last_accessed": "2025-01-14T18:30:00.000Z",
        "is_self": false,
        "is_mobile": true,
        "browser": "Mobile Safari",
        "browser_version": "17.2"
    }
]
```

### Описание полей
| Поле              | Описание                            |
| ----------------- | ----------------------------------- |
| `id`              | ID сессии                           |
| `last_accessed`   | Время последнего доступа (ISO 8601) |
| `is_self`         | Является ли эта сессия текущей      |
| `is_mobile`       | Мобильное устройство или планшет    |
| `browser`         | Название браузера (может быть null) |
| `browser_version` | Версия браузера (может быть null)   |

---

### `DELETE /users/@me/sessions/all`
<sub>Strict Auth required</sub>  
Завершить все сессии, кроме текущей.

---

### `DELETE /users/@me/sessions/:id`
<sub>Strict Auth required</sub>  
Завершить конкретную сессию по её ID.

### URL параметры
| Имя  | Описание  | Тип данных |
| ---- | --------- | ---------- |
| `id` | ID сессии | `number`   |

---

## Работы и избранное

### `GET /users/@me/works`
<sub>Strict Auth required</sub>  
Получить список повязок, созданных текущим пользователем.

### Тело ответа
Возвращает массив повязок:
```json
[
    {
        "id": 529,
        "external_id": "vehwm5",
        "title": "Повязка",
        "description": "Описание",
        "base64": "<b64>",
        "flags": 2,
        "accent_color": "#737473",
        "creation_date": "2025-07-04T19:00:10.223Z",
        "stars_count": 3,
        "tags": ["Именные"],
        "author": {
            "id": "236188357351178344",
            "name": "AndcoolSystems",
            "username": "andcoolsystems",
            "public": true
        },
        "access_level": 2,
        "star_type": 0,
        "moderation": null
    }
]
```

---

### `GET /users/@me/stars`
<sub>Strict Auth required</sub>  
Получить список повязок, добавленных в избранное.

### Query параметры
| Имя    | Описание                           | Тип данных | Стандартное значение |
| ------ | ---------------------------------- | ---------- | -------------------- |
| `take` | Количество работ на одной странице | `number`   | `24`                 |
| `page` | Номер страницы                     | `number`   | `0`                  |

### Тело ответа
```json
{
    "data": [
        {
            "id": 123,
            "external_id": "abc123",
            "title": "Повязка в избранном",
            "description": "Описание",
            "base64": "<b64>",
            "flags": 3,
            "accent_color": "#FF5733",
            "creation_date": "2024-12-01T14:30:00.000Z",
            "stars_count": 45,
            "tags": ["Тематические"],
            "author": {
                "id": "987654321",
                "name": "OtherUser",
                "username": "otheruser",
                "public": true
            },
            "access_level": 2,
            "star_type": 0,
            "moderation": null
        }
    ],
    "totalCount": 156
}
```

---

## Настройки

### `GET /users/@me/settings`
<sub>Strict Auth required</sub>  
Получить настройки текущего пользователя.

### Тело ответа
```json
{
    "userID": "236188357351178344",
    "public_profile": true,
    "can_be_public": true,
    "avatar": {
        "current": "discord",
        "available": ["discord", "minecraft", "google"]
    }
}
```

### Описание полей
| Поле               | Описание                                                 |
| ------------------ | -------------------------------------------------------- |
| `userID`           | Snowflake ID пользователя                                |
| `public_profile`   | Публичность профиля                                      |
| `can_be_public`    | Может ли профиль быть публичным (есть ли хоть 1 повязка) |
| `avatar.current`   | Текущий выбранный источник аватара                       |
| `avatar.available` | Массив доступных источников аватаров                     |

### Особенности
- `can_be_public` возвращает `true` только если у пользователя есть хотя бы одна повязка
- `avatar.available` содержит только те провайдеры, которые подключены и имеют аватар
- Для изменения настроек используйте `PATCH /users/@me`

---

## Уведомления

### `GET /users/@me/notifications`
<sub>Strict Auth required</sub>  
Получить список уведомлений пользователя.

### Query параметры
| Имя    | Описание                           | Тип данных | Стандартное значение |
| ------ | ---------------------------------- | ---------- | -------------------- |
| `take` | Количество уведомлений на странице | `number`   | `5`                  |
| `page` | Номер страницы                     | `number`   | `0`                  |

---

## Подписки

### `GET /users/@me/subscriptions`
<sub>Strict Auth required</sub>  
Получить список подписок текущего пользователя (на кого я подписан).

### Тело ответа
```json
[
    {
        "id": "123456",
        "name": "UserName",
        "username": "username",
        "joined_at": "2023-01-15T10:30:00.000Z"
    }
]
```

### Описание полей
| Поле        | Описание                      |
| ----------- | ----------------------------- |
| `id`        | Snowflake ID пользователя     |
| `name`      | Отображаемое имя              |
| `username`  | Username для URL              |
| `joined_at` | Дата регистрации пользователя |

---

### `GET /users/@me/subscribers`
<sub>Strict Auth required</sub>  
Получить список подписчиков текущего пользователя (кто подписан на меня).

### Тело ответа
```json
[
    {
        "id": "789012",
        "name": "Subscriber",
        "username": "subscriber",
        "joined_at": "2024-05-10T14:20:00.000Z",
        "subscribed": false
    }
]
```

### Описание полей
| Поле         | Описание                                                        |
| ------------ | --------------------------------------------------------------- |
| `id`         | Snowflake ID пользователя                                       |
| `name`       | Отображаемое имя                                                |
| `username`   | Username для URL                                                |
| `joined_at`  | Дата регистрации пользователя                                   |
| `subscribed` | Подписан ли я в ответ на этого пользователя (взаимная подписка) |

---

### `POST /users/:username/subscribers`
<sub>Strict Auth required</sub>  
Подписаться на пользователя.

### URL параметры
| Имя        | Описание              | Тип данных |
| ---------- | --------------------- | ---------- |
| `username` | Username пользователя | `string`   |

### Тело ответа
```json
{
    "count": 24
}
```

### Описание полей
| Поле    | Описание                                          |
| ------- | ------------------------------------------------- |
| `count` | Новое количество подписчиков у этого пользователя |

---

### `DELETE /users/:username/subscribers`
<sub>Strict Auth required</sub>  
Отписаться от пользователя.

### URL параметры
| Имя        | Описание              | Тип данных |
| ---------- | --------------------- | ---------- |
| `username` | Username пользователя | `string`   |

### Тело ответа
```json
{
    "count": 23
}
```

### Описание полей
| Поле    | Описание                                          |
| ------- | ------------------------------------------------- |
| `count` | Новое количество подписчиков у этого пользователя |

---

## Автозагрузка скина

### `GET /users/@me/autoload-skin`
<sub>Weak Auth optional</sub>  
Получить скин для автозагрузки в мастерской (если включена опция в настройках).

`Content-Type: image/png`

### Ответ
- **200** - возвращает PNG изображение скина
- **204** - автозагрузка отключена или профиль не подключен

---

## Публичные профили

### `GET /users/:username`
<sub>Weak Auth optional</sub>  
Получить публичный профиль пользователя по username.

### URL параметры
| Имя        | Описание              | Тип данных |
| ---------- | --------------------- | ---------- |
| `username` | Username пользователя | `string`   |

### Тело ответа

**Если запрашиваемый username совпадает с текущим пользователем:**
```json
{
    "is_self": true
}
```

**В остальных случаях:**
```json
{
    "userID": "236188357351178344",
    "username": "andcoolsystems",
    "name": "AndcoolSystems",
    "joined_at": "2023-01-15T10:30:00.000Z",
    "profile_theme": 0,
    "banner_color": "#FF5733",
    "works": [
        {
            "id": 529,
            "external_id": "vehwm5",
            "title": "Повязка пользователя",
            "description": "Описание",
            "base64": "<b64>",
            "flags": 2,
            "accent_color": "#737473",
            "creation_date": "2025-07-04T19:00:10.223Z",
            "stars_count": 3,
            "tags": ["Именные"],
            "author": {
                "id": "236188357351178344",
                "name": "AndcoolSystems",
                "username": "andcoolsystems",
                "public": true
            },
            "access_level": 2,
            "star_type": 0,
            "moderation": null
        }
    ],
    "stars_count": 156,
    "subscribers_count": 23,
    "is_subscribed": false,
    "badges": 0
}
```

### Описание полей
| Поле                | Описание                                                         |
| ------------------- | ---------------------------------------------------------------- |
| `userID`            | Snowflake ID пользователя                                        |
| `username`          | Username для URL                                                 |
| `name`              | Отображаемое имя                                                 |
| `joined_at`         | Дата регистрации (ISO 8601)                                      |
| `profile_theme`     | Тема профиля (0=светлая, 1=темная, 2=системная)                  |
| `banner_color`      | Цвет баннера/темы (HEX)                                          |
| `works`             | Массив публичных повязок пользователя                            |
| `stars_count`       | Суммарное количество звезд на всех повязках                      |
| `subscribers_count` | Количество подписчиков                                           |
| `is_subscribed`     | Подписан ли текущий пользователь (undefined если не авторизован) |
| `badges`            | Битовая маска значков пользователя                               |

### Особенности
- Если передан токен авторизации, поле `is_subscribed` показывает, подписан ли текущий пользователь на этот профиль
- Если профиль приватный или у пользователя нет повязок, вернется ошибка 404
---

### `GET /users/:username/og`
<sub>Weak Auth optional</sub>  
Получить данные для Open Graph preview профиля пользователя.

### URL параметры
| Имя        | Описание              | Тип данных |
| ---------- | --------------------- | ---------- |
| `username` | Username пользователя | `string`   |

### Тело ответа
```json
{
    "userID": "236188357351178344",
    "username": "andcoolsystems",
    "name": "AndcoolSystems",
    "banner_color": "#FF5733",
    "works_count": 42,
    "stars_count": 156
}
```

### Описание полей
| Поле           | Описание                                    |
| -------------- | ------------------------------------------- |
| `userID`       | Snowflake ID пользователя                   |
| `username`     | Username для URL                            |
| `name`         | Отображаемое имя                            |
| `banner_color` | Цвет баннера/темы (HEX)                     |
| `works_count`  | Количество повязок пользователя             |
| `stars_count`  | Суммарное количество звезд на всех повязках |
