-- Animal Care demonstration and verification queries (PostgreSQL).
-- These queries use the column names defined in schema.sql.

-- 1. Product catalog with its category (INNER JOIN).
-- The current products table has no brand column, so the query shows SKU instead.
SELECT
    p.id,
    p.name AS product_name,
    p.sku,
    c.name AS category_name,
    p.price,
    p.stock_quantity,
    p.target_species,
    p.min_age_months,
    p.max_age_months
FROM products AS p
INNER JOIN categories AS c ON c.id = p.category_id
ORDER BY p.id;

-- 2. Products suitable for a dog aged 24 months.
-- Change the two values in pet_profile to demonstrate another pet profile.
WITH pet_profile AS (
    SELECT 'dog'::text AS species, 24::integer AS age_months
)
SELECT
    p.id,
    p.name,
    p.sku,
    p.price,
    p.stock_quantity,
    p.target_species,
    p.min_age_months,
    p.max_age_months
FROM products AS p
CROSS JOIN pet_profile AS pet
WHERE p.is_active
  AND p.stock_quantity > 0
  AND p.target_species IN (pet.species, 'all')
  AND p.min_age_months <= pet.age_months
  AND (p.max_age_months IS NULL OR p.max_age_months >= pet.age_months)
ORDER BY p.price ASC;

-- 3. Product count, total stock, and average price per category (LEFT JOIN + GROUP BY).
SELECT
    c.name AS category_name,
    COUNT(p.id) AS total_products,
    COALESCE(SUM(p.stock_quantity), 0) AS total_stock,
    ROUND(COALESCE(AVG(p.price), 0), 2) AS avg_price
FROM categories AS c
LEFT JOIN products AS p ON p.category_id = c.id
GROUP BY c.id, c.name
ORDER BY total_products DESC, c.name;

-- 4. Users and their pets (LEFT JOIN).
-- Pet age is stored as birth_date and can be derived when needed.
SELECT
    u.id AS user_id,
    u.full_name AS user_name,
    u.email,
    p.name AS pet_name,
    p.species,
    p.breed,
    p.birth_date,
    p.sex,
    p.weight_kg,
    p.notes AS special_needs
FROM users AS u
LEFT JOIN pets AS p ON p.user_id = u.id
ORDER BY u.id, p.id;

-- 5. Order details with purchased product snapshots (multiple JOINs).
-- unit_price and line_total are the purchase-time price and generated line amount.
SELECT
    o.id AS order_id,
    u.full_name AS customer_name,
    o.status,
    o.recipient_name,
    o.shipping_address,
    oi.product_name,
    oi.quantity,
    oi.unit_price,
    oi.line_total
FROM orders AS o
INNER JOIN users AS u ON u.id = o.user_id
INNER JOIN order_items AS oi ON oi.order_id = o.id
ORDER BY o.id DESC, oi.id;

-- 6. Average rating and review count per product (LEFT JOIN + aggregation).
SELECT
    p.id,
    p.name,
    COUNT(r.id) AS reviews_count,
    ROUND(COALESCE(AVG(r.rating), 0), 1) AS avg_rating
FROM products AS p
LEFT JOIN reviews AS r
    ON r.product_id = p.id
   AND r.is_published
GROUP BY p.id, p.name
ORDER BY avg_rating DESC, reviews_count DESC, p.id;
