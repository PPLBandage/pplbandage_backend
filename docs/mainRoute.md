# Корневые эндпоинты API
**Здесь располагаются все эндпоинты, являющиеся общими и не относящиеся ни к одному из частей бекенда.**

---

### `GET /`
Основной эндпоинт API, делает redirect с кодом `308` в корень URL (`/`).

---

### `GET /ping`
Делает ping запрос на сервер. Не имеет ограничений по частоте запросов. Максимально быстро возвращает ответ от сервера с кодом `200`

### Тело ответа
```json
{
    "statusCode": 200,
    "message": "pong"
}
```

---

### `GET /sitemap.xml`
`Content-Type: text/xml`  
Возвращает актуальную карту сайта в формате `xml` для индекса поисковых систем. Содержит основные страницы сайта, а так же все публичные повязки и профили авторов.  

### Пример карты сайта
```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://pplbandage.ru/</loc>
        <priority>1</priority>
    </url>
    <url>
        <loc>https://pplbandage.ru/workshop</loc>
        <priority>0.8</priority>
    </url>
</urlset>
```