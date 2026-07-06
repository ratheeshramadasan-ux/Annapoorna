-- Annapoorna menu/plan seed data
PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO app_settings (key, value, value_type, category, description, is_public)
VALUES
('delivery_enabled', 'false', 'boolean', 'fulfillment', 'Enable customer delivery option', 1),
('delivery_fee', '0', 'number', 'fulfillment', 'Delivery fee in dollars', 1),
('delivery_min_order_amount', '0', 'number', 'fulfillment', 'Minimum delivery order amount in dollars', 1),
('delivery_service_area_note', '', 'string', 'fulfillment', 'Delivery service area note', 1);

INSERT OR IGNORE INTO menu_categories (name, description, sort_order)
VALUES
('Thali', 'Daily, weekly and monthly homemade thali meals', 1),
('Breakfast', 'Breakfast and tiffin items', 2),
('Sides', 'Sides and add-ons', 3);

INSERT OR REPLACE INTO menu_items (
  id, category_id, name, description, food_type, base_price_cents, image_url,
  is_active, is_public, sort_order, serving_unit, serving_definition,
  bulk_order_eligible, min_bulk_quantity, max_bulk_quantity, bulk_notice_hours,
  menu_start_date, menu_end_date
)
VALUES
(101, (SELECT id FROM menu_categories WHERE name = 'Thali'), 'Regular Veg Thali', 'Rice, dal, curry, dry item, pickle and papad.', 'veg', 1400, '/assets/veg-thali.png', 1, 1, 1, 'plate', '1 plate = 1 complete thali', 0, NULL, NULL, 24, date('now'), NULL),
(102, (SELECT id FROM menu_categories WHERE name = 'Breakfast'), 'Medu Vada', 'Crisp homemade medu vada served by the plate.', 'veg', 600, '/assets/Put Kadala.jpeg', 1, 1, 2, 'plate', '1 plate = 4 vada', 1, 20, 200, 48, date('now'), NULL),
(103, (SELECT id FROM menu_categories WHERE name = 'Sides'), 'Sambar', 'South Indian lentil stew.', 'veg', 500, '/assets/veg-thali.png', 1, 1, 3, 'cup', '1 cup = 250 ml', 1, 10, 100, 24, date('now'), NULL),
(104, (SELECT id FROM menu_categories WHERE name = 'Sides'), 'Rice', 'Steamed rice.', 'veg', 300, '/assets/veg-thali.png', 1, 1, 4, 'box', '1 box = 500 ml', 1, 10, 100, 24, date('now'), NULL),
(105, (SELECT id FROM menu_categories WHERE name = 'Sides'), 'Dal', 'Comforting homemade dal.', 'veg', 400, '/assets/veg-thali.png', 1, 1, 5, 'cup', '1 cup = 250 ml', 1, 10, 100, 24, date('now'), NULL),
(106, (SELECT id FROM menu_categories WHERE name = 'Sides'), 'Curry of the Day', 'Seasonal homemade curry.', 'veg', 500, '/assets/veg-thali.png', 1, 1, 6, 'cup', '1 cup = 250 ml', 0, NULL, NULL, 24, date('now'), NULL);

DELETE FROM menu_item_availability WHERE menu_item_id IN (101, 102, 103, 104, 105, 106);
DELETE FROM menu_availability WHERE menu_item_id IN (101, 102, 103, 104, 105, 106);

INSERT INTO menu_item_availability (menu_item_id, availability_type, day_of_week, start_date, end_date, is_active)
VALUES
(101, 'weekly', 1, date('now'), NULL, 1),
(101, 'weekly', 2, date('now'), NULL, 1),
(101, 'weekly', 3, date('now'), NULL, 1),
(101, 'weekly', 4, date('now'), NULL, 1),
(101, 'weekly', 5, date('now'), NULL, 1),
(102, 'weekly', 0, date('now'), NULL, 1),
(102, 'weekly', 1, date('now'), NULL, 1),
(102, 'weekly', 2, date('now'), NULL, 1),
(102, 'weekly', 3, date('now'), NULL, 1),
(102, 'weekly', 4, date('now'), NULL, 1),
(102, 'weekly', 5, date('now'), NULL, 1),
(102, 'weekly', 6, date('now'), NULL, 1),
(103, 'weekly', 0, date('now'), NULL, 1),
(103, 'weekly', 1, date('now'), NULL, 1),
(103, 'weekly', 2, date('now'), NULL, 1),
(103, 'weekly', 3, date('now'), NULL, 1),
(103, 'weekly', 4, date('now'), NULL, 1),
(103, 'weekly', 5, date('now'), NULL, 1),
(103, 'weekly', 6, date('now'), NULL, 1);

INSERT INTO menu_availability (menu_item_id, day_of_week, start_date, end_date, active)
SELECT menu_item_id, day_of_week, start_date, end_date, is_active
FROM menu_item_availability
WHERE menu_item_id IN (101, 102, 103, 104, 105, 106);

DELETE FROM menu_prices WHERE menu_item_id IN (101, 102, 103, 104, 105, 106);
INSERT INTO menu_prices (menu_item_id, price_type, price_cents, effective_from, effective_to, active)
VALUES
(101, 'regular', 1400, date('now'), NULL, 1),
(102, 'regular', 600, date('now'), NULL, 1),
(102, 'bulk', 500, date('now'), NULL, 1),
(103, 'regular', 500, date('now'), NULL, 1),
(104, 'regular', 300, date('now'), NULL, 1),
(105, 'regular', 400, date('now'), NULL, 1),
(106, 'regular', 500, date('now'), NULL, 1);

INSERT OR REPLACE INTO thali_plans (id, name, description, plan_type, active, available_days, start_date, end_date)
VALUES
(201, 'Daily Veg Thali', 'Single-day homemade veg thali.', 'daily', 1, '1,2,3,4,5', date('now'), NULL),
(202, 'Weekly Veg Thali', 'Five weekday veg thali plan.', 'weekly', 1, '1,2,3,4,5', date('now'), NULL),
(203, 'Monthly Veg Thali', 'Monthly weekday veg thali plan.', 'monthly', 1, '1,2,3,4,5', date('now'), NULL);

DELETE FROM menu_prices WHERE thali_plan_id IN (201, 202, 203);
INSERT INTO menu_prices (thali_plan_id, price_type, price_cents, effective_from, effective_to, active)
VALUES
(201, 'subscription', 1400, date('now'), NULL, 1),
(202, 'subscription', 6500, date('now'), NULL, 1),
(203, 'subscription', 25000, date('now'), NULL, 1);

INSERT OR IGNORE INTO thali_plan_items (thali_plan_id, menu_item_id, quantity)
VALUES
(201, 104, 1),
(201, 105, 1),
(201, 106, 1),
(202, 101, 5),
(203, 101, 20);

INSERT OR IGNORE INTO ingredients (name, unit, current_stock, minimum_stock, cost_per_unit_cents, active)
VALUES
('Urad dal', 'gram', NULL, NULL, NULL, 1),
('Onion', 'gram', NULL, NULL, NULL, 1),
('Ginger', 'gram', NULL, NULL, NULL, 1),
('Green chilli', 'piece', NULL, NULL, NULL, 1),
('Oil', 'ml', NULL, NULL, NULL, 1);

DELETE FROM menu_item_ingredients WHERE menu_item_id = 102;
INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_required, unit, quantity_basis)
VALUES
(102, (SELECT id FROM ingredients WHERE name = 'Urad dal'), 120, 'gram', 'per plate'),
(102, (SELECT id FROM ingredients WHERE name = 'Onion'), 30, 'gram', 'per plate'),
(102, (SELECT id FROM ingredients WHERE name = 'Ginger'), 5, 'gram', 'per plate'),
(102, (SELECT id FROM ingredients WHERE name = 'Green chilli'), 2, 'piece', 'per plate'),
(102, (SELECT id FROM ingredients WHERE name = 'Oil'), 20, 'ml', 'per plate');
