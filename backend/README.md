# Animal Care API

REST API на Node.js, Express и PostgreSQL. Поля соответствуют схеме из database/schema.sql.

## Запуск локально

1. Установить Node.js 20 или новее и PostgreSQL.
2. Создать базу animal_care.
3. Выполнить database/schema.sql, затем database/seed.sql из корня репозитория.
4. В папке backend скопировать .env.example в .env. Указать адрес базы и заменить JWT_SECRET на случайную строку не короче 32 байт. Файл .env игнорируется Git.
5. Из папки backend выполнить npm install, затем npm run dev.
6. Проверить GET http://localhost:3000/api/health.

## Маршруты

Публичные:
- GET /api/health — состояние API и соединения с базой.
- GET /api/products — каталог. Параметры: q, category (slug), pet (dog или cat), minPrice, maxPrice, sort (price_asc, price_desc, name), limit, offset.
- GET /api/products/:id — карточка товара.
- POST /api/auth/register — регистрация, JSON: full_name, email, password, необязательное phone.
- POST /api/auth/login — вход, JSON: email, password.

Требуют заголовок Authorization: Bearer <token>:
- GET /api/pets — питомцы текущего покупателя.
- POST /api/pets — name, species (dog/cat), необязательные breed, birth_date, sex, weight_kg, notes.
- GET /api/cart — активная корзина и сумма.
- POST /api/cart/items — product_id и необязательное quantity; quantity прибавляется к текущему.
- PATCH /api/cart/items/:id — новое quantity для позиции.
- DELETE /api/cart/items/:id — удалить позицию.
- POST /api/orders — recipient_name, recipient_phone, shipping_address и необязательное customer_note.
- GET /api/orders/my — заказы и их позиции текущего покупателя.

Ошибки имеют формат { error: { code, message } }. Сервер проверяет владельца корзины и питомцев, остатки товаров и входные поля. Пароль хранится только как bcrypt-хеш. Оформление заказа записывает заказ и строки, уменьшает остатки и переводит корзину в converted одной PostgreSQL-транзакцией.

Товары читаются из PostgreSQL; перед подключением интерфейса согласовать с фронтендом формат ответов и хранение JWT.
