-- Development/demo data for Animal Care. Safe to run more than once.
-- Test admin: admin@animalcare.test / ChangeMe123!
-- Change this password before any shared or production deployment.

BEGIN;

INSERT INTO users (email, password_hash, full_name, role)
VALUES (
    'admin@animalcare.test',
    crypt('ChangeMe123!', gen_salt('bf', 12)),
    'Тестовый администратор',
    'admin'
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = now();

INSERT INTO categories (name, slug, description)
VALUES
    ('Корма для собак', 'dog-food', 'Сухие и влажные корма для собак.'),
    ('Корма для кошек', 'cat-food', 'Сухие и влажные корма для кошек.'),
    ('Лакомства', 'treats', 'Лакомства для поощрения и ухода за питомцем.'),
    ('Игрушки', 'toys', 'Игрушки для активности и развития питомцев.'),
    ('Гигиена', 'hygiene', 'Средства для ухода за шерстью и гигиены.'),
    ('Аксессуары', 'accessories', 'Повседневные аксессуары для животных.')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = true;

INSERT INTO products (
    category_id, sku, slug, name, description, price, stock_quantity,
    target_species, min_age_months, max_age_months, image_url, is_active
)
SELECT c.id, p.sku, p.slug, p.name, p.description, p.price, p.stock_quantity,
       p.target_species, p.min_age_months, p.max_age_months, p.image_url, true
FROM (VALUES
    ('dog-food', 'FOOD-DOG-ADULT-001', 'dry-food-dog-adult',
     'Сухой корм для взрослых собак, 3 кг', 'Полнорационный корм для взрослых собак средних пород.',
     5490.00::numeric, 24, 'dog', 12, 120, NULL::text),
    ('dog-food', 'FOOD-DOG-PUPPY-001', 'dry-food-dog-puppy',
     'Сухой корм для щенков, 2 кг', 'Корм для щенков с адаптированным размером гранул.',
     4290.00::numeric, 18, 'dog', 0, 12, NULL::text),
    ('cat-food', 'FOOD-CAT-ADULT-001', 'dry-food-cat-adult',
     'Сухой корм для взрослых кошек, 2 кг', 'Полнорационный корм для взрослых домашних кошек.',
     3890.00::numeric, 30, 'cat', 12, 180, NULL::text),
    ('cat-food', 'FOOD-CAT-KITTEN-001', 'dry-food-cat-kitten',
     'Сухой корм для котят, 1.5 кг', 'Корм для котят с первого месяца жизни до года.',
     3190.00::numeric, 16, 'cat', 1, 12, NULL::text),
    ('treats', 'TREAT-DOG-001', 'training-treats-dog',
     'Тренировочные лакомства для собак', 'Небольшие лакомства для поощрения во время занятий.',
     1290.00::numeric, 42, 'dog', 3, NULL::integer, NULL::text),
    ('treats', 'TREAT-CAT-001', 'salmon-treats-cat',
     'Лакомства с лососем для кошек', 'Хрустящие кусочки с лососем для взрослых кошек.',
     990.00::numeric, 35, 'cat', 6, NULL::integer, NULL::text),
    ('toys', 'TOY-DOG-001', 'rubber-ball-dog',
     'Прочная резиновая игрушка-мяч', 'Мяч для активных игр и апортировки.',
     1590.00::numeric, 20, 'dog', 3, NULL::integer, NULL::text),
    ('toys', 'TOY-CAT-001', 'feather-wand-cat',
     'Дразнилка с перьями для кошек', 'Интерактивная игрушка для совместной игры.',
     1190.00::numeric, 27, 'cat', 2, NULL::integer, NULL::text),
    ('hygiene', 'CARE-ALL-001', 'gentle-shampoo-pets',
     'Мягкий шампунь для собак и кошек', 'Шампунь для бережного ухода за шерстью.',
     1790.00::numeric, 14, 'all', 2, NULL::integer, NULL::text),
    ('accessories', 'ACC-DOG-001', 'adjustable-dog-collar',
     'Регулируемый ошейник для собак', 'Ошейник с регулируемой длиной для ежедневных прогулок.',
     2490.00::numeric, 12, 'dog', 3, NULL::integer, NULL::text)
) AS p(category_slug, sku, slug, name, description, price, stock_quantity,
       target_species, min_age_months, max_age_months, image_url)
JOIN categories AS c ON c.slug = p.category_slug
ON CONFLICT (sku) DO UPDATE
SET category_id = EXCLUDED.category_id,
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    stock_quantity = EXCLUDED.stock_quantity,
    target_species = EXCLUDED.target_species,
    min_age_months = EXCLUDED.min_age_months,
    max_age_months = EXCLUDED.max_age_months,
    image_url = EXCLUDED.image_url,
    is_active = EXCLUDED.is_active,
    updated_at = now();

COMMIT;
