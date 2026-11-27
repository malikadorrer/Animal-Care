require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined
});
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) throw new Error('Set a random JWT_SECRET of at least 32 bytes in .env.');
const port = Number(process.env.PORT || 3000);

class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, code, message) => { throw new ApiError(status, code, message); };
const text = (value, field, max = 500) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, 'VALIDATION_ERROR', 'Проверьте поле ' + field + '.');
  return value.trim();
};
const idValue = (value) => {
  if (!/^[0-9]+$/.test(String(value)) || BigInt(value) < 1n) fail(400, 'INVALID_ID', 'Некорректный идентификатор.');
  return String(value);
};
const userView = (u) => ({ id: u.id, email: u.email, full_name: u.full_name, phone: u.phone, role: u.role, created_at: u.created_at });
const tokenFor = (u) => jwt.sign({ role: u.role }, jwtSecret, { subject: String(u.id), expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',').map((x) => x.trim()) : true }));
app.use(express.json({ limit: '100kb' }));

const auth = route(async (req, res, next) => {
  const match = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) fail(401, 'AUTH_REQUIRED', 'Войдите в аккаунт, чтобы продолжить.');
  try {
    const payload = jwt.verify(match[1], jwtSecret);
    req.user = { id: idValue(payload.sub), role: payload.role };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    fail(401, 'INVALID_TOKEN', 'Сессия недействительна или истекла. Войдите снова.');
  }
  next();
});

async function activeCart(db, userId) {
  const result = await db.query(
    "INSERT INTO cart (user_id, status) VALUES ($1, 'active') ON CONFLICT (user_id) WHERE status = 'active' DO UPDATE SET updated_at = now() RETURNING id, user_id, status",
    [userId]
  );
  return result.rows[0];
}
async function cartView(db, userId) {
  const cart = await activeCart(db, userId);
  const result = await db.query(
    "SELECT ci.id, ci.product_id, ci.quantity, p.name, p.sku, p.price, p.stock_quantity, p.image_url, c.name AS category_name, (p.price * ci.quantity)::numeric(12,2)::text AS line_total FROM cart_items ci JOIN products p ON p.id=ci.product_id JOIN categories c ON c.id=p.category_id WHERE ci.cart_id=$1 ORDER BY ci.added_at, ci.id",
    [cart.id]
  );
  const total = result.rows.reduce((sum, item) => sum + Number(item.line_total), 0);
  return { id: cart.id, items: result.rows, total_amount: total.toFixed(2) };
}

app.get('/api/health', route(async (req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }));

app.get('/api/products', route(async (req, res) => {
  const q = req.query.q ? text(String(req.query.q), 'q', 100) : null;
  const category = req.query.category ? text(String(req.query.category), 'category', 80) : null;
  const pet = req.query.pet ? String(req.query.pet) : null;
  if (pet && !['dog', 'cat'].includes(pet)) fail(400, 'VALIDATION_ERROR', 'pet должен быть dog или cat.');
  const minPrice = req.query.minPrice == null ? null : Number(req.query.minPrice);
  const maxPrice = req.query.maxPrice == null ? null : Number(req.query.maxPrice);
  if ([minPrice, maxPrice].some((x) => x != null && (!Number.isFinite(x) || x < 0))) fail(400, 'VALIDATION_ERROR', 'Некорректная цена.');
  const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const sort = { price_asc: 'p.price ASC', price_desc: 'p.price DESC', name: 'p.name ASC' }[req.query.sort] || 'p.id DESC';
  const result = await pool.query(
    "SELECT p.id,p.category_id,c.name AS category_name,c.slug AS category_slug,p.sku,p.slug,p.name,p.description,p.price,p.stock_quantity,p.target_species,p.min_age_months,p.max_age_months,p.image_url FROM products p JOIN categories c ON c.id=p.category_id WHERE p.is_active=true AND ($1::text IS NULL OR p.name ILIKE '%'||$1||'%' OR p.description ILIKE '%'||$1||'%') AND ($2::text IS NULL OR c.slug=$2) AND ($3::text IS NULL OR p.target_species IN ($3,'all')) AND ($4::numeric IS NULL OR p.price >= $4) AND ($5::numeric IS NULL OR p.price <= $5) ORDER BY " + sort + " LIMIT $6 OFFSET $7",
    [q, category, pet, minPrice, maxPrice, limit, offset]
  );
  res.json({ items: result.rows, pagination: { limit, offset, count: result.rowCount } });
}));
app.get('/api/products/:id', route(async (req, res) => {
  const result = await pool.query(
    "SELECT p.id,p.category_id,c.name AS category_name,c.slug AS category_slug,p.sku,p.slug,p.name,p.description,p.price,p.stock_quantity,p.target_species,p.min_age_months,p.max_age_months,p.image_url FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=$1 AND p.is_active=true",
    [idValue(req.params.id)]
  );
  if (!result.rowCount) fail(404, 'PRODUCT_NOT_FOUND', 'Товар не найден.');
  res.json({ item: result.rows[0] });
}));

app.post('/api/auth/register', route(async (req, res) => {
  const fullName = text(req.body.full_name, 'full_name', 120);
  const email = text(req.body.email, 'email', 254).toLowerCase();
  const password = req.body.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'VALIDATION_ERROR', 'Укажите корректный email.');
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) fail(400, 'VALIDATION_ERROR', 'Пароль должен быть длиной от 8 символов и не более 72 байт.');
  const phone = req.body.phone ? text(req.body.phone, 'phone', 40) : null;
  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query("INSERT INTO users (email,password_hash,full_name,phone) VALUES ($1,$2,$3,$4) RETURNING id,email,full_name,phone,role,created_at", [email, hash, fullName, phone]);
  const user = result.rows[0];
  res.status(201).json({ user: userView(user), token: tokenFor(user) });
}));
app.post('/api/auth/login', route(async (req, res) => {
  const email = text(req.body.email, 'email', 254).toLowerCase();
  const password = req.body.password;
  if (typeof password !== 'string' || !password) fail(400, 'VALIDATION_ERROR', 'Введите пароль.');
  const result = await pool.query('SELECT id,email,password_hash,full_name,phone,role,created_at FROM users WHERE email=$1', [email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) fail(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль.');
  res.json({ user: userView(user), token: tokenFor(user) });
}));

app.get('/api/pets', auth, route(async (req, res) => {
  const result = await pool.query('SELECT id,user_id,name,species,breed,birth_date,sex,weight_kg,notes,created_at FROM pets WHERE user_id=$1 ORDER BY created_at DESC,id DESC', [req.user.id]);
  res.json({ items: result.rows });
}));
app.post('/api/pets', auth, route(async (req, res) => {
  const name = text(req.body.name, 'name', 100);
  const species = req.body.species;
  if (!['dog', 'cat'].includes(species)) fail(400, 'VALIDATION_ERROR', 'species должен быть dog или cat.');
  const sex = req.body.sex || null;
  if (sex && !['female', 'male', 'unknown'].includes(sex)) fail(400, 'VALIDATION_ERROR', 'Некорректное значение sex.');
  const weight = req.body.weight_kg == null || req.body.weight_kg === '' ? null : Number(req.body.weight_kg);
  if (weight != null && (!Number.isFinite(weight) || weight <= 0)) fail(400, 'VALIDATION_ERROR', 'weight_kg должен быть больше нуля.');
  const result = await pool.query('INSERT INTO pets (user_id,name,species,breed,birth_date,sex,weight_kg,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,user_id,name,species,breed,birth_date,sex,weight_kg,notes,created_at', [req.user.id, name, species, req.body.breed ? text(req.body.breed,'breed',100) : null, req.body.birth_date || null, sex, weight, req.body.notes ? text(req.body.notes,'notes',1000) : null]);
  res.status(201).json({ item: result.rows[0] });
}));

app.get('/api/cart', auth, route(async (req, res) => { res.json({ cart: await cartView(pool, req.user.id) }); }));
app.post('/api/cart/items', auth, route(async (req, res) => {
  const productId = idValue(req.body.product_id);
  const quantity = req.body.quantity == null ? 1 : Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) fail(400, 'VALIDATION_ERROR', 'quantity должен быть целым числом больше нуля.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const product = await client.query('SELECT id,stock_quantity FROM products WHERE id=$1 AND is_active=true FOR UPDATE', [productId]);
    if (!product.rowCount) fail(404, 'PRODUCT_NOT_FOUND', 'Товар не найден.');
    const cart = await activeCart(client, req.user.id);
    const current = await client.query('SELECT quantity FROM cart_items WHERE cart_id=$1 AND product_id=$2', [cart.id, productId]);
    if (quantity + (current.rows[0]?.quantity || 0) > product.rows[0].stock_quantity) fail(409, 'INSUFFICIENT_STOCK', 'На складе недостаточно товара.');
    await client.query("INSERT INTO cart_items (cart_id,product_id,quantity) VALUES ($1,$2,$3) ON CONFLICT (cart_id,product_id) DO UPDATE SET quantity=cart_items.quantity+EXCLUDED.quantity", [cart.id, productId, quantity]);
    await client.query('UPDATE cart SET updated_at=now() WHERE id=$1', [cart.id]);
    await client.query('COMMIT');
    res.status(201).json({ cart: await cartView(pool, req.user.id) });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}));
app.patch('/api/cart/items/:id', auth, route(async (req, res) => {
  const itemId = idValue(req.params.id), quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) fail(400, 'VALIDATION_ERROR', 'quantity должен быть целым числом больше нуля.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const item = await client.query("SELECT ci.id,ci.cart_id,p.stock_quantity FROM cart_items ci JOIN cart c ON c.id=ci.cart_id JOIN products p ON p.id=ci.product_id WHERE ci.id=$1 AND c.user_id=$2 AND c.status='active' FOR UPDATE OF ci,p", [itemId, req.user.id]);
    if (!item.rowCount) fail(404, 'CART_ITEM_NOT_FOUND', 'Позиция корзины не найдена.');
    if (quantity > item.rows[0].stock_quantity) fail(409, 'INSUFFICIENT_STOCK', 'На складе недостаточно товара.');
    await client.query('UPDATE cart_items SET quantity=$1 WHERE id=$2', [quantity, itemId]);
    await client.query('UPDATE cart SET updated_at=now() WHERE id=$1', [item.rows[0].cart_id]);
    await client.query('COMMIT');
    res.json({ cart: await cartView(pool, req.user.id) });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}));
app.delete('/api/cart/items/:id', auth, route(async (req, res) => {
  const result = await pool.query("DELETE FROM cart_items ci USING cart c WHERE ci.cart_id=c.id AND ci.id=$1 AND c.user_id=$2 AND c.status='active' RETURNING ci.cart_id", [idValue(req.params.id), req.user.id]);
  if (!result.rowCount) fail(404, 'CART_ITEM_NOT_FOUND', 'Позиция корзины не найдена.');
  await pool.query('UPDATE cart SET updated_at=now() WHERE id=$1', [result.rows[0].cart_id]);
  res.json({ cart: await cartView(pool, req.user.id) });
}));

app.post('/api/orders', auth, route(async (req, res) => {
  const recipientName = text(req.body.recipient_name, 'recipient_name', 120);
  const recipientPhone = text(req.body.recipient_phone, 'recipient_phone', 40);
  const address = text(req.body.shipping_address, 'shipping_address', 500);
  const note = req.body.customer_note ? text(req.body.customer_note, 'customer_note', 1000) : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cart = await client.query("SELECT id FROM cart WHERE user_id=$1 AND status='active' FOR UPDATE", [req.user.id]);
    if (!cart.rowCount) fail(400, 'CART_EMPTY', 'Корзина пуста.');
    const cartId = cart.rows[0].id;
    const items = await client.query('SELECT ci.product_id,ci.quantity,p.name,p.sku,p.price,p.stock_quantity,p.is_active FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.cart_id=$1 ORDER BY p.id FOR UPDATE OF ci,p', [cartId]);
    if (!items.rowCount) fail(400, 'CART_EMPTY', 'Корзина пуста.');
    if (items.rows.some((item) => !item.is_active || item.stock_quantity < item.quantity)) fail(409, 'INSUFFICIENT_STOCK', 'Товар недоступен или остатка не хватает. Обновите корзину.');
    const orderResult = await client.query("INSERT INTO orders (user_id,cart_id,recipient_name,recipient_phone,shipping_address,customer_note,total_amount) SELECT $1,$2,$3,$4,$5,$6,SUM(p.price*ci.quantity) FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.cart_id=$2 RETURNING id,user_id,cart_id,recipient_name,recipient_phone,shipping_address,status,total_amount,customer_note,created_at", [req.user.id, cartId, recipientName, recipientPhone, address, note]);
    const order = orderResult.rows[0];
    await client.query('INSERT INTO order_items (order_id,product_id,product_name,sku,unit_price,quantity) SELECT $1,p.id,p.name,p.sku,p.price,ci.quantity FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.cart_id=$2', [order.id, cartId]);
    const updated = await client.query('UPDATE products p SET stock_quantity=p.stock_quantity-ci.quantity,updated_at=now() FROM cart_items ci WHERE ci.cart_id=$1 AND ci.product_id=p.id AND p.stock_quantity>=ci.quantity RETURNING p.id', [cartId]);
    if (updated.rowCount !== items.rowCount) fail(409, 'INSUFFICIENT_STOCK', 'Остаток изменился. Повторите оформление.');
    await client.query("UPDATE cart SET status='converted',updated_at=now() WHERE id=$1", [cartId]);
    await client.query('COMMIT');
    res.status(201).json({ order: { ...order, items: items.rows.map((x) => ({ product_id: x.product_id, product_name: x.name, sku: x.sku, unit_price: x.price, quantity: x.quantity })) } });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}));
app.get('/api/orders/my', auth, route(async (req, res) => {
  const result = await pool.query("SELECT o.id,o.status,o.total_amount,o.recipient_name,o.recipient_phone,o.shipping_address,o.customer_note,o.created_at,o.updated_at,COALESCE(json_agg(json_build_object('id',oi.id,'product_id',oi.product_id,'product_name',oi.product_name,'sku',oi.sku,'unit_price',oi.unit_price,'quantity',oi.quantity,'line_total',oi.line_total)) FILTER (WHERE oi.id IS NOT NULL),'[]') AS items FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id WHERE o.user_id=$1 GROUP BY o.id ORDER BY o.created_at DESC LIMIT 50", [req.user.id]);
  res.json({ items: result.rows });
}));

app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Маршрут не найден.' } }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  let status = error.status || 500, code = error.code || 'INTERNAL_ERROR', message = error.message || 'Внутренняя ошибка сервера.';
  if (error.code === '23505') { status = 409; code = 'ALREADY_EXISTS'; message = 'Запись с такими данными уже существует.'; }
  if (['23503','23514','22P02'].includes(error.code)) { status = 400; code = 'INVALID_DATA'; message = 'Данные не прошли проверку.'; }
  if (status >= 500) console.error(error);
  res.status(status).json({ error: { code, message } });
});

const server = app.listen(port, () => console.log('Animal Care API listening on port ' + port));
async function shutdown() { server.close(async () => { await pool.end(); process.exit(0); }); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
