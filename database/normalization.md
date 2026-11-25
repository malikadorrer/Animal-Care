# Animal Care database: normalization and ER model

## Normalization through 3NF

- **1NF:** Each column stores one value of its declared type. Product lists are not packed into a cart or order cell: `cart_items` and `order_items` store one product per row. Repeating groups such as `pet1`, `pet2` are not used.
- **2NF:** Every table has a primary key. In the associative `favorites` table, the composite key `(user_id, product_id)` identifies a single user-product favorite; its `created_at` belongs to that pair. Cart and order lines are separate rows with their own keys and foreign keys.
- **3NF:** Descriptive category data lives in `categories`; `products` refers to it through `category_id`. Pet details live in `pets`, user details in `users`, and product review details in `reviews`. This avoids storing category and user descriptions repeatedly in dependent tables. Product values copied to `order_items` (`product_name`, `sku`, and `unit_price`) are transaction-time snapshots, so later catalog edits do not rewrite the purchase history. `orders.total_amount` is the total captured for that order at checkout.

## ER diagram

The ER diagram is stored as `er-diagram.png`; its editable source is `er-diagram.dbml` and a vector rendering is `er-diagram.svg`. It contains all ten tables from `schema.sql` and marks primary and foreign keys.

| Relationship | Cardinality |
| --- | --- |
| `users` → `pets` | 1:N |
| `categories` → `categories` (parent → child) | 1:N |
| `categories` → `products` | 1:N |
| `users` → `cart` | 1:N over history; at most one active cart per user |
| `cart` → `cart_items` | 1:N |
| `products` → `cart_items` | 1:N |
| `users` → `orders` | 1:N |
| `cart` → `orders` | 1:0..1 (`orders.cart_id` is unique and nullable) |
| `orders` → `order_items` | 1:N |
| `products` → `order_items` | 1:N when the product still exists; the reference may be null to preserve order history |
| `users` ↔ `products` through `favorites` | M:N |
| `users` → `reviews` and `products` → `reviews` | each 1:N; one review per user-product pair |

## Running the demo queries

Apply `schema.sql`, then `seed.sql`, then run `queries.sql` in PostgreSQL, pgAdmin, DBeaver, or `psql`. Query 2 is parameterized with a sample dog profile (`dog`, 24 months); edit the values in its `pet_profile` CTE to demonstrate other recommendations. The schema has no `brand`, `age_group`, or `delivery_method` columns: it stores SKU, species and month bounds, and order recipient/address details instead. The demo queries use those real fields.
