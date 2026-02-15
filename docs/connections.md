# Подключения OAuth
**API для управления подключенными OAuth аккаунтами пользователя.**

---

## Общая информация

Пользователи могут подключать различные OAuth провайдеры к своему аккаунту для:
- Использования нескольких методов авторизации
- Синхронизации аватаров из разных источников
- Интеграции с Minecraft для автозагрузки скинов

Поддерживаемые провайдеры:
- **Discord**
- **Google**
- **Twitch**
- **Telegram**
- **Minecraft**

> [!NOTE]
> Все эндпоинты этого модуля требуют строгой авторизации.

---

## `GET /users/@me/connections`
<sub>Strict Auth required</sub>  
Получить список всех подключенных аккаунтов.

### Тело ответа
```json
{
    "userID": "236188357351178344",
    "discord": {
        "user_id": "123456789012345678",
        "name": "User Name",
        "username": "username",
        "connected_at": "2025-01-15T10:00:00.000Z"
    },
    "minecraft": {
        "nickname": "Player",
        "uuid": "1420c63cb1114453993fb3479ba1d4c6",
        "last_cached": 1736942400000,
        "valid": true,
        "autoload": true,
        "minecraft_main_page_skin": false
    },
    "google": {
        "sub": "1234567890",
        "email": "u***@gmail.com",
        "name": "User Name",
        "connected_at": "2025-01-15T10:00:00.000Z"
    },
    "twitch": {
        "uid": "12345678",
        "login": "username",
        "name": "UserName",
        "connected_at": "2025-01-15T10:00:00.000Z"
    },
    "telegram": {
        "id": "123456789",
        "login": "username",
        "name": "User",
        "connected_at": "2025-01-15T10:00:00.000Z"
    }
}
```

**Описание полей:**

**Discord:**
- `user_id` - ID пользователя в Discord
- `name` - Глобальное имя пользователя
- `username` - Username в Discord
- `connected_at` - Дата подключения

**Minecraft:**
- `nickname` - Никнейм игрока
- `uuid` - UUID профиля Minecraft (без дефисов)
- `last_cached` - Unix timestamp (мс) последнего обновления кэша
- `valid` - Отображать никнейм в поиске в мастерской
- `autoload` - Автозагрузка скина в мастерской
- `minecraft_main_page_skin` - Использовать скин Minecraft на главной странице

**Google:**
- `sub` - Subject identifier (уникальный ID)
- `email` - Email (замаскированный)
- `name` - Имя пользователя
- `connected_at` - Дата подключения

**Twitch:**
- `uid` - User ID в Twitch
- `login` - Login (никнейм)
- `name` - Отображаемое имя
- `connected_at` - Дата подключения

**Telegram:**
- `id` - Telegram user ID
- `login` - Username в Telegram
- `name` - Имя пользователя
- `connected_at` - Дата подключения

> [!NOTE]
> Если провайдер не подключен, его значение будет `null`.

---

## Minecraft

### `POST /users/@me/connections/minecraft`
<sub>Strict Auth required</sub>  
Подключить Minecraft профиль к аккаунту.

### Тело запроса
| Поле   | Описание                  | Тип данных | Обязательный | Ограничения |
| ------ | ------------------------- | ---------- | :----------: | ----------- |
| `code` | 6-значный код авторизации | `string`   |      Да      | Длина: 6    |

### Тело ответа
```json
{
    "uuid": "1420c63cb1114453993fb3479ba1d4c6"
}
```

### Особенности
Код генерируется через систему авторизации [mc-oauth](https://github.com/Andcool-Systems/mc-oauth-rs) и действителен ограниченное время.

---

### `POST /users/@me/connections/minecraft/cache/purge`
<sub>Strict Auth required</sub>  
Принудительно обновить кэш скина Minecraft.

### Ограничения
- **5 запросов в минуту**

### Особенности
Полезно когда пользователь изменил скин на сервере Mojang и хочет обновить его в кэше PPLBandage.

> [!WARNING]
> Профиль Minecraft должен быть подключен. Иначе вернется ошибка **404**.

---

### `DELETE /users/@me/connections/minecraft`
<sub>Strict Auth required</sub>  
Отключить Minecraft профиль от аккаунта.

---

## Discord

### `POST /users/@me/connections/discord`
<sub>Strict Auth required</sub>  
Подключить Discord аккаунт.

### Тело запроса
| Поле   | Описание                            | Тип данных | Обязательный |
| ------ | ----------------------------------- | ---------- | :----------: |
| `code` | Authorization code от Discord OAuth | `string`   |      Да      |

### Процесс подключения
1. Получить URL авторизации через `GET /auth/url/discord?connect=true`
2. Перенаправить пользователя на полученный URL
3. Получить code из redirect callback
4. Отправить code на этот эндпоинт

---

### `DELETE /users/@me/connections/discord`
<sub>Strict Auth required</sub>  
Отключить Discord аккаунт.

> [!WARNING]
> Если Discord был единственным методом авторизации, убедитесь что подключен другой провайдер, иначе доступ к аккаунту будет потерян.

---

## Google

### `POST /users/@me/connections/google`
<sub>Strict Auth required</sub>  
Подключить Google аккаунт.

### Тело запроса
| Поле   | Описание                           | Тип данных | Обязательный |
| ------ | ---------------------------------- | ---------- | :----------: |
| `code` | Authorization code от Google OAuth | `string`   |      Да      |

---

### `DELETE /users/@me/connections/google`
<sub>Strict Auth required</sub>  
Отключить Google аккаунт.

---

## Twitch

### `POST /users/@me/connections/twitch`
<sub>Strict Auth required</sub>  
Подключить Twitch аккаунт.

### Тело запроса
| Поле   | Описание                           | Тип данных | Обязательный |
| ------ | ---------------------------------- | ---------- | :----------: |
| `code` | Authorization code от Twitch OAuth | `string`   |      Да      |

---

### `DELETE /users/@me/connections/twitch`
<sub>Strict Auth required</sub>  
Отключить Twitch аккаунт.

---

## Telegram

### `POST /users/@me/connections/telegram`
<sub>Strict Auth required</sub>  
Подключить Telegram аккаунт.

### Тело запроса
| Поле   | Описание                              | Тип данных | Обязательный |
| ------ | ------------------------------------- | ---------- | :----------: |
| `code` | Authorization code от Telegram Widget | `string`   |      Да      |

---

### `DELETE /users/@me/connections/telegram`
<sub>Strict Auth required</sub>  
Отключить Telegram аккаунт.

---

## Безопасность

> [!IMPORTANT]
> - Всегда поддерживайте как минимум один подключенный метод авторизации
> - При отключении последнего провайдера API вернет ошибку
> - Каждый OAuth провайдер может быть подключен только к одному аккаунту PPLBandage
