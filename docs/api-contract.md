# Контракт API для интеграции

Базовый префикс: `/api`. Frontend и backend используют эти общие маршруты и поля.

| Метод | Путь | Назначение | Данные |
|---|---|---|---|
| GET | `/products` | Каталог | query: `search`, `category_id`, `species`, `min_price`, `max_price`; ответ `items` |
| GET | `/products/:id` | Карточка товара | `id`, `name`, `description`, `price`, `stock_quantity`, `target_species`, `image_url`, `category` |
| POST | `/auth/register` | Регистрация | `full_name`, `email`, `password` |
| POST | `/auth/login` | Вход | `email`, `password` |
| GET, POST | `/pets` | Список/создание питомца | `name`, `species`, `breed`, `birth_date` |
| GET | `/cart` | Корзина | позиции с `product_id`, `name`, `price`, `quantity`, `line_total`; итог `total` |
| POST | `/cart/items` | Добавить товар | `product_id`, `quantity` |
| PATCH | `/cart/items/:id` | Изменить количество | `quantity` |
| DELETE | `/cart/items/:id` | Удалить позицию | понятный результат операции |
| POST | `/orders` | Оформить заказ | `recipient_name`, `recipient_phone`, `shipping_address`, необязательное `customer_note` |
| GET | `/orders/my` | Мои заказы | заказы с позициями текущего покупателя |

## Правила

- Закрытые маршруты требуют входа. Пользователь определяется сервером, переданный клиентом `user_id` не считается доверенным.
- Формат ошибки: `{ "message": "Понятное сообщение" }`; использовать подходящий HTTP-статус (`400`, `401`, `404`, `409`, `500`).
- Заказ, строки заказа, проверка/уменьшение остатка и очистка корзины выполняются одной транзакцией.
- Поля БД: `users.full_name/email/password_hash`; `pets.species`; `products.stock_quantity/target_species`; `cart_items.quantity`; `orders.recipient_name/recipient_phone/shipping_address/total_amount`; `order_items.product_name/unit_price/quantity`.
- Пароли и токены не возвращать в ответах и не сохранять в Git.
