# Эмоции (Emotes)
**API для получения эмоций в формате изображений.**

---

## Общая информация

Система эмоций позволяет получать изображения эмоций по их ID или имени. Эмоции хранятся в формате WebP для оптимизации размера.

> [!NOTE]
> Этот эндпоинт не требует авторизации и доступен публично.

---

## `GET /emote`
Получить изображение эмоции по ID или имени.

`Content-Type: image/webp`

### Query параметры
| Имя  | Описание                         | Тип данных | Обязательный |
| ---- | -------------------------------- | ---------- | :----------: |
| `q`  | ULID эмоции или её имя           | `string`   |      Да      |

### Заголовки ответа
- `Cache-Control: public, max-age=86400, immutable` - кэширование на 24 часа

### Особенности
- Если `q` является валидным ULID (26 символов, формат: `[0-9A-HJKMNP-TV-Z]`), эмоция ищется по ID
- В противном случае выполняется поиск по имени (case-insensitive)
- Изображение возвращается в формате WebP для оптимизации размера

### Примеры запросов

**По ULID:**
```
GET /api/v1/emote?q=01ARZ3NDEKTSV4RRFFQ69G5FAV
```

**По имени:**
```
GET /api/v1/emote?q=happy
GET /api/v1/emote?q=HAPPY
```

### Ответ
- **200** - возвращает WebP изображение эмоции
- **404** - эмоция не найдена

---

## Кэширование

Эмоции агрессивно кэшируются:
- **Браузер**: 24 часа (`max-age=86400`)
- **Иммутабельность**: помечены как `immutable` (не требуют ревалидации)
- **CDN**: автоматически кэшируются на CDN при использовании

---

## Примеры использования

### HTML
```html
<img src="https://pplbandage.ru/api/v1/emote?q=happy" alt="Happy emote">
<img src="https://pplbandage.ru/api/v1/emote?q=01ARZ3NDEKTSV4RRFFQ69G5FAV" alt="Emote">
```

### Markdown
```markdown
![Happy](https://pplbandage.ru/api/v1/emote?q=happy)
```

### JavaScript Fetch
```javascript
const emoteUrl = 'https://pplbandage.ru/api/v1/emote?q=happy';
const response = await fetch(emoteUrl);
const blob = await response.blob();
const imageUrl = URL.createObjectURL(blob);
```

---

## Формат ULID

ULID (Universally Unique Lexicographically Sortable Identifier) - это 26-символьный идентификатор, использующий следующие символы:
```
0123456789ABCDEFGHJKMNPQRSTVWXYZ
```

Пример валидного ULID: `01ARZ3NDEKTSV4RRFFQ69G5FAV`
