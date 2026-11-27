# API-контракт — фактический backend

Ниже зафиксировано поведение `backend/server.js` из ветки `backend`. Все пути ниже имеют префикс `/api`.

## Маршруты

| Метод | Путь | Вход | Ответ |
|---|---|---|---|
| GET | `/health` | — | `{ status }` |
| GET | `/products` | query: `q`, `category` (slug), `pet` (`dog/cat`), `minPrice`, `maxPrice`, `sort`, `limit`, `offset` | `{ items, pagination }` |
| GET | `/products/:id` | ID товара | `{ item }` |
| POST | `/auth/register` | `full_name`, `email`, `password`, optional `phone` | `{ user, token }` |
| POST | `/auth/login` | `email`, `password` | `{ user, token }` |
| GET | `/pets` | Bearer token | `{ items }` |
| POST | `/pets` | `name`, `species`, optional `breed`, `birth_date`, `sex`, `weight_kg`, `notes` | `{ item }` |
| GET | `/cart` | Bearer token | `{ cart: { id, items, total_amount } }` |
| POST | `/cart/items` | `product_id`, optional `quantity` | `{ cart }` |
| PATCH | `/cart/items/:id` | `quantity` | `{ cart }` |
| DELETE | `/cart/items/:id` | ID позиции | `{ cart }` |
| POST | `/orders` | `recipient_name`, `recipient_phone`, `shipping_address`, optional `customer_note` | `{ order }` (включает `items`) |
| GET | `/orders/my` | Bearer token | `{ items }` — заказы с позициями |

## Правила реализации

- Закрытые маршруты используют `Authorization: Bearer <token>`. Сервер берёт владельца корзины, питомцев и заказов из токена.
- Ошибки имеют вид `{ error: { code, message } }`. Важные коды: `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `PRODUCT_NOT_FOUND`, `CART_EMPTY`, `INSUFFICIENT_STOCK`, `CART_ITEM_NOT_FOUND`.
- При добавлении товара `quantity` прибавляется к уже находящемуся в корзине количеству; PATCH задаёт новое итоговое количество.
- Оформление заказа проходит транзакцией: создаёт заказ и позиции, проверяет/уменьшает остатки и переводит корзину в `converted`.
- Поля и статусы должны совпадать со схемой PostgreSQL: у пользователей сервер возвращает `full_name`, `email`, `phone`, `role`; у корзины есть статус; товар содержит `stock_quantity`, `target_species`, `is_active`; ошибки стандартизированы вложенным `error`.

## Отличия от прежнего черновика

Используйте `q/category/pet/minPrice/maxPrice`, а не `search/category_id/species/min_price/max_price`; корзина отдаёт `total_amount`, а не `total`; ошибка вложена в `error`; фильтры и поля пользователя соответствуют текущему backend.
