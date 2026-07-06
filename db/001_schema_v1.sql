-- Annapoorna D1 Schema v1
-- Clean reset and final database architecture
-- force new upload 2026-07-06 full schema
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS waitlist_requests;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS message_attachments;
DROP TABLE IF EXISTS conversation_messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS review_moderation_history;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS expense_categories;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS payment_audit_history;
DROP TABLE IF EXISTS payment_matches;
DROP TABLE IF EXISTS payment_import_rows;
DROP TABLE IF EXISTS payment_imports;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS recurring_order_items;
DROP TABLE IF EXISTS recurring_orders;
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_item_preferences;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS order_date_change_requests;
DROP TABLE IF EXISTS pickup_slot_overrides;
DROP TABLE IF EXISTS pickup_slots;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS order_pricing_adjustments;
DROP TABLE IF EXISTS pricing_rules;
DROP TABLE IF EXISTS menu_item_daily_capacity;
DROP TABLE IF EXISTS menu_item_ingredients;
DROP TABLE IF EXISTS ingredients;
DROP TABLE IF EXISTS thali_plan_items;
DROP TABLE IF EXISTS thali_plans;
DROP TABLE IF EXISTS menu_prices;
DROP TABLE IF EXISTS menu_item_allergens;
DROP TABLE IF EXISTS menu_item_preferences;
DROP TABLE IF EXISTS menu_item_availability;
DROP TABLE IF EXISTS menu_availability;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS menu_categories;
DROP TABLE IF EXISTS customer_consents;
DROP TABLE IF EXISTS customer_addresses;
DROP TABLE IF EXISTS customer_verifications;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS admin_approval_history;
DROP TABLE IF EXISTS admin_users;

PRAGMA foreign_keys = ON;

CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  status TEXT NOT NULL DEFAULT 'pending',
  whatsapp_number TEXT,
  email_alert_enabled INTEGER NOT NULL DEFAULT 1,
  whatsapp_alert_enabled INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT,
  password_salt TEXT,
  google_subject TEXT,
  approved_by_admin_id INTEGER,
  approved_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_approval_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_admin_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  email_verified_at TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  phone_verified_at TEXT,
  preferred_contact_method TEXT NOT NULL DEFAULT 'whatsapp',
  notification_consent INTEGER NOT NULL DEFAULT 1,
  consent_timestamp TEXT,
  status TEXT NOT NULL DEFAULT 'pending_verification',
  order_count INTEGER NOT NULL DEFAULT 0,
  total_spent_cents INTEGER NOT NULL DEFAULT 0,
  last_order_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  verification_type TEXT NOT NULL,
  destination TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE customer_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  label TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Canada',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE customer_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  consent_type TEXT NOT NULL,
  consent_value INTEGER NOT NULL DEFAULT 1,
  consent_text TEXT,
  consented_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE menu_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  food_type TEXT NOT NULL DEFAULT 'veg',
  base_price_cents INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_public INTEGER NOT NULL DEFAULT 1,
  is_plan INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  spice_level TEXT,
  allergen_notes TEXT,
  serving_unit TEXT NOT NULL DEFAULT 'plate',
  serving_definition TEXT,
  bulk_order_eligible INTEGER NOT NULL DEFAULT 0,
  min_bulk_quantity INTEGER,
  max_bulk_quantity INTEGER,
  bulk_notice_hours INTEGER NOT NULL DEFAULT 24,
  menu_start_date TEXT,
  menu_end_date TEXT,
  public_sold_out INTEGER NOT NULL DEFAULT 0,
  internal_planned_quantity INTEGER NOT NULL DEFAULT 0,
  internal_cooked_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES menu_categories(id)
);

CREATE TABLE menu_item_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  availability_type TEXT NOT NULL,
  day_of_week INTEGER,
  specific_date TEXT,
  month_of_year INTEGER,
  day_of_month INTEGER,
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE menu_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  day_of_week INTEGER,
  specific_date TEXT,
  start_date TEXT,
  end_date TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE menu_item_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  preference_name TEXT NOT NULL,
  preference_type TEXT NOT NULL DEFAULT 'option',
  extra_price_cents INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE menu_item_allergens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  allergen_name TEXT NOT NULL,
  contains_allergen INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE menu_item_daily_capacity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  service_date TEXT NOT NULL,
  quantity_planned INTEGER NOT NULL DEFAULT 0,
  quantity_cooked INTEGER NOT NULL DEFAULT 0,
  quantity_ordered INTEGER NOT NULL DEFAULT 0,
  quantity_picked_up INTEGER NOT NULL DEFAULT 0,
  quantity_cancelled INTEGER NOT NULL DEFAULT 0,
  public_sold_out INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(menu_item_id, service_date),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE menu_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER,
  thali_plan_id INTEGER,
  price_type TEXT NOT NULL DEFAULT 'regular',
  price_cents INTEGER NOT NULL DEFAULT 0,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE thali_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  available_days TEXT,
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE thali_plan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thali_plan_id INTEGER NOT NULL,
  menu_item_id INTEGER NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thali_plan_id) REFERENCES thali_plans(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL,
  current_stock REAL,
  minimum_stock REAL,
  cost_per_unit_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_item_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,
  quantity_required REAL NOT NULL,
  unit TEXT NOT NULL,
  quantity_basis TEXT NOT NULL DEFAULT 'per plate',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

CREATE TABLE pricing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL,
  pricing_method TEXT NOT NULL,
  applies_to TEXT NOT NULL DEFAULT 'all_items',
  menu_item_id INTEGER,
  category_id INTEGER,
  customer_id INTEGER,
  minimum_quantity INTEGER DEFAULT 0,
  maximum_quantity INTEGER,
  minimum_order_amount_cents INTEGER DEFAULT 0,
  discount_percent REAL,
  discount_amount_cents INTEGER,
  fixed_unit_price_cents INTEGER,
  fixed_total_price_cents INTEGER,
  start_date TEXT,
  end_date TEXT,
  is_bulk_order INTEGER NOT NULL DEFAULT 0,
  requires_admin_approval INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 1,
  auto_apply INTEGER NOT NULL DEFAULT 1,
  is_stackable INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  FOREIGN KEY (category_id) REFERENCES menu_categories(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE pickup_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  day_of_week INTEGER,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  max_orders INTEGER,
  max_quantity INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pickup_slot_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pickup_slot_id INTEGER,
  override_date TEXT NOT NULL,
  is_closed INTEGER NOT NULL DEFAULT 0,
  start_time TEXT,
  end_time TEXT,
  max_orders INTEGER,
  max_quantity INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pickup_slot_id) REFERENCES pickup_slots(id)
);

CREATE TABLE holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  holiday_date TEXT NOT NULL,
  end_date TEXT,
  notice_message TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  submission_token TEXT UNIQUE,
  customer_id INTEGER,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  order_type TEXT NOT NULL DEFAULT 'daily',
  fulfillment_method TEXT NOT NULL DEFAULT 'pickup',
  delivery_address TEXT,
  delivery_city TEXT,
  delivery_postal_code TEXT,
  delivery_instructions TEXT,
  allergy_notes TEXT,
  order_notes TEXT,
  selected_start_date TEXT,
  selected_end_date TEXT,
  selected_days TEXT,
  pickup_date TEXT NOT NULL,
  pickup_time TEXT NOT NULL,
  pickup_slot_id INTEGER,
  pickup_datetime TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  customer_facing_status TEXT NOT NULL DEFAULT 'Order Received',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_total_cents INTEGER NOT NULL DEFAULT 0,
  tax_total_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_method TEXT,
  payment_reference TEXT,
  is_bulk_order INTEGER NOT NULL DEFAULT 0,
  bulk_rule_id INTEGER,
  requires_admin_approval INTEGER NOT NULL DEFAULT 0,
  customer_notes TEXT,
  admin_notes TEXT,
  cancelled_at TEXT,
  cancelled_by TEXT,
  cancellation_reason TEXT,
  reordered_from_order_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (pickup_slot_id) REFERENCES pickup_slots(id),
  FOREIGN KEY (bulk_rule_id) REFERENCES pricing_rules(id),
  FOREIGN KEY (reordered_from_order_id) REFERENCES orders(id)
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  menu_item_id INTEGER,
  thali_plan_id INTEGER,
  item_name_snapshot TEXT NOT NULL,
  item_description_snapshot TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL DEFAULT 0,
  line_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  line_discount_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  total_price REAL NOT NULL DEFAULT 0,
  order_date TEXT,
  customer_preferences TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  FOREIGN KEY (thali_plan_id) REFERENCES thali_plans(id)
);

CREATE TABLE order_item_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id INTEGER NOT NULL,
  preference_name TEXT NOT NULL,
  preference_value TEXT,
  extra_price_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id)
);

CREATE TABLE order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_type TEXT NOT NULL,
  changed_by_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE order_date_change_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  old_selected_days TEXT,
  requested_selected_days TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE order_pricing_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  pricing_rule_id INTEGER,
  adjustment_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  pricing_method TEXT NOT NULL,
  original_amount_cents INTEGER NOT NULL DEFAULT 0,
  adjusted_amount_cents INTEGER NOT NULL DEFAULT 0,
  savings_amount_cents INTEGER NOT NULL DEFAULT 0,
  applied_by_type TEXT NOT NULL DEFAULT 'system',
  applied_by_id INTEGER,
  is_manual INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (pricing_rule_id) REFERENCES pricing_rules(id)
);

CREATE TABLE recurring_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  name TEXT,
  recurrence_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  pickup_slot_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  pause_start_date TEXT,
  pause_end_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (pickup_slot_id) REFERENCES pickup_slots(id)
);

CREATE TABLE recurring_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recurring_order_id INTEGER NOT NULL,
  menu_item_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  preferences TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recurring_order_id) REFERENCES recurring_orders(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  customer_id INTEGER,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending_verification',
  expected_amount_cents INTEGER NOT NULL DEFAULT 0,
  received_amount_cents INTEGER NOT NULL DEFAULT 0,
  payment_reference TEXT,
  interac_sender_name TEXT,
  interac_confirmation_number TEXT,
  interac_sent_at TEXT,
  payment_proof_image_url TEXT,
  verified_by_admin_id INTEGER,
  verified_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (verified_by_admin_id) REFERENCES admin_users(id)
);

CREATE TABLE payment_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_file_url TEXT,
  imported_by_admin_id INTEGER,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'processed',
  notes TEXT,
  FOREIGN KEY (imported_by_admin_id) REFERENCES admin_users(id)
);

CREATE TABLE payment_import_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_import_id INTEGER NOT NULL,
  transaction_date TEXT,
  description TEXT,
  amount_cents INTEGER,
  sender_name TEXT,
  reference_text TEXT,
  raw_row_json TEXT,
  matched_status TEXT NOT NULL DEFAULT 'unmatched',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_import_id) REFERENCES payment_imports(id)
);

CREATE TABLE payment_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_import_row_id INTEGER,
  payment_id INTEGER,
  order_id INTEGER,
  confidence_score REAL,
  match_status TEXT NOT NULL DEFAULT 'suggested',
  matched_by_type TEXT,
  matched_by_id INTEGER,
  matched_at TEXT,
  notes TEXT,
  FOREIGN KEY (payment_import_row_id) REFERENCES payment_import_rows(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE payment_audit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_type TEXT NOT NULL,
  changed_by_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id)
);

CREATE TABLE inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  inventory_type TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  current_quantity REAL NOT NULL DEFAULT 0,
  reorder_level REAL NOT NULL DEFAULT 0,
  cost_per_unit_cents INTEGER DEFAULT 0,
  supplier TEXT,
  expiry_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_item_id INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost_cents INTEGER,
  total_cost_cents INTEGER,
  reference_type TEXT,
  reference_id INTEGER,
  notes TEXT,
  created_by_admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id),
  FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
);

CREATE TABLE expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL,
  category_id INTEGER,
  category_snapshot TEXT,
  vendor TEXT,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  payment_method TEXT,
  receipt_image_url TEXT,
  notes TEXT,
  created_by_admin_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
);

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  order_id INTEGER,
  reviewer_contact TEXT,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  is_verified_customer INTEGER NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  approved_by_admin_id INTEGER,
  approved_at TEXT,
  rejected_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (approved_by_admin_id) REFERENCES admin_users(id)
);

CREATE TABLE review_moderation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_admin_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES reviews(id),
  FOREIGN KEY (changed_by_admin_id) REFERENCES admin_users(id)
);

CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_type TEXT NOT NULL,
  record_type TEXT,
  record_id INTEGER,
  customer_id INTEGER,
  order_id INTEGER,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE conversation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id INTEGER,
  sender_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'comment',
  visibility TEXT NOT NULL DEFAULT 'internal_only',
  message_text TEXT NOT NULL,
  send_whatsapp INTEGER NOT NULL DEFAULT 0,
  whatsapp_status TEXT DEFAULT 'not_required',
  whatsapp_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE message_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES conversation_messages(id)
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_value TEXT NOT NULL,
  customer_id INTEGER,
  order_id INTEGER,
  conversation_message_id INTEGER,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_message_id TEXT,
  provider_response TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  failed_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (conversation_message_id) REFERENCES conversation_messages(id)
);

CREATE TABLE waitlist_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  menu_item_id INTEGER NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  requested_date TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string',
  category TEXT,
  description TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL,
  actor_id INTEGER,
  action TEXT NOT NULL,
  record_type TEXT,
  record_id INTEGER,
  old_values_json TEXT,
  new_values_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_pickup_date ON orders(pickup_date);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_menu_items_active ON menu_items(is_active, is_public);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_conversations_record ON conversations(record_type, record_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_inventory_type ON inventory_items(inventory_type);

INSERT OR IGNORE INTO admin_users (email, name, role, status, approved_at)
VALUES
('ratheesh.ramadasan@gmail.com', 'Ratheesh Ramadasan', 'owner', 'approved', CURRENT_TIMESTAMP),
('lachureshmi6@gmail.com', 'Reshmi', 'owner', 'approved', CURRENT_TIMESTAMP);

UPDATE admin_users
SET password_salt = '7174f92079ac67cf85fa29132122a42b',
    password_hash = 'f9538e7d682ddfb75b468e829d96a7f38f03cb14e3fa7cf550bb21f22ebe3067',
    whatsapp_number = '+13685992299',
    email_alert_enabled = 1,
    whatsapp_alert_enabled = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'ratheesh.ramadasan@gmail.com';

UPDATE admin_users
SET password_salt = 'e57f687a4e2b447c694b68a4ca8d2d83',
    password_hash = 'c60931b8a6a9cb438bb612efc8b2f20ac702bd3004020a706ed6d39d7d2a3a08',
    whatsapp_number = '+14034814101',
    email_alert_enabled = 1,
    whatsapp_alert_enabled = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'lachureshmi6@gmail.com';

INSERT OR IGNORE INTO menu_categories (name, description, sort_order)
VALUES
('Thali', 'Homemade vegetarian thali meals', 1),
('Breakfast', 'Breakfast and tiffin items', 2),
('Special', 'Festival and special menu items', 3),
('Dessert', 'Desserts and sweets', 5),
('Snacks', 'Homemade snacks and light bites', 6);

INSERT OR IGNORE INTO expense_categories (name, description, sort_order)
VALUES
('Ingredients', 'Food ingredients and groceries', 1),
('Packaging', 'Containers, bags, lids and labels', 2),
('Gas / Fuel', 'Fuel and transport-related costs', 3),
('Utilities', 'Electricity, water, gas and utilities', 4),
('Kitchen Equipment', 'Kitchen tools and equipment', 5),
('Cleaning Supplies', 'Cleaning and safety supplies', 6),
('Marketing', 'Promotion and marketing costs', 7),
('Licensing', 'Business licence and compliance costs', 8),
('Miscellaneous', 'Other expenses', 99);

INSERT OR IGNORE INTO pickup_slots (name, day_of_week, start_time, end_time, max_orders, max_quantity, sort_order)
VALUES
('Weekday Pickup 12 PM', 1, '12:00', '12:30', 20, 40, 1),
('Weekday Pickup 12 PM', 2, '12:00', '12:30', 20, 40, 1),
('Weekday Pickup 12 PM', 3, '12:00', '12:30', 20, 40, 1),
('Weekday Pickup 12 PM', 4, '12:00', '12:30', 20, 40, 1),
('Weekday Pickup 12 PM', 5, '12:00', '12:30', 20, 40, 1),
('Sunday Breakfast Pickup', 0, '10:00', '10:30', 20, 40, 2);

INSERT OR REPLACE INTO app_settings (key, value, value_type, category, description, is_public)
VALUES
('business_name', 'Annapoorna', 'string', 'business', 'Business display name', 1),
('business_phone', '+14034814101', 'string', 'business', 'Business phone number', 1),
('business_whatsapp_number', '14034814101', 'string', 'business', 'WhatsApp number without plus sign', 1),
('business_email', '', 'string', 'business', 'Business email address', 1),
('pickup_address', '72 Amblehurst GDNS NW, Calgary, AB', 'string', 'business', 'Pickup address', 1),
('timezone', 'America/Edmonton', 'string', 'business', 'Business timezone', 0),
('default_currency', 'CAD', 'string', 'business', 'Default currency', 1),
('weekday_pickup_time', '12:00 PM', 'string', 'business', 'Default weekday pickup time', 1),
('sunday_pickup_time', '10:00 AM', 'string', 'business', 'Default Sunday pickup time', 1),
('home_menu_lines', 'Rice, chapathi, sabji, curd and pickle
One weekday curry from the curry list
Non-veg option with chicken fry or pepper chicken
Sunday idli, sambar and coconut chutney', 'text', 'home', 'Home page menu card lines', 1),
('home_pickup_lines', '72 Amblehurst GDNS NW
Calgary, AB
Weekday/Saturday pickup: 12:00 PM
Sunday breakfast pickup: 10:00 AM
Pre-order required', 'text', 'home', 'Home page pickup card lines', 1),
('home_perfect_for_lines', 'Students
Office staff
Working professionals
Families and guests', 'text', 'home', 'Home page perfect-for card lines', 1),
('delivery_enabled', 'false', 'boolean', 'fulfillment', 'Enable customer delivery option', 1),
('delivery_fee', '0', 'number', 'fulfillment', 'Delivery fee in dollars', 1),
('delivery_min_order_amount', '0', 'number', 'fulfillment', 'Minimum delivery order amount in dollars', 1),
('delivery_service_area_note', '', 'string', 'fulfillment', 'Delivery service area note', 1),

('public_show_available_quantity', 'false', 'boolean', 'public', 'Show available quantity to customers', 0),
('public_show_sold_out_status', 'true', 'boolean', 'public', 'Show sold out status publicly', 1),
('public_show_prices', 'true', 'boolean', 'public', 'Show prices publicly', 1),
('public_show_discounts', 'true', 'boolean', 'public', 'Show discounts publicly', 1),
('public_show_bulk_pricing', 'true', 'boolean', 'public', 'Show bulk pricing publicly', 1),
('public_show_admin_link', 'false', 'boolean', 'public', 'Show admin link publicly', 0),
('public_allow_reviews', 'true', 'boolean', 'public', 'Allow review submission', 1),
('google_review_url', '', 'string', 'reviews', 'Google review link', 1),
('public_allow_preorder', 'true', 'boolean', 'public', 'Allow preorder', 1),

('public_allow_customer_registration', 'true', 'boolean', 'customer', 'Allow customer registration', 1),
('public_allow_guest_order', 'true', 'boolean', 'customer', 'Allow guest checkout', 1),
('customer_login_enabled', 'true', 'boolean', 'customer', 'Enable customer login', 1),
('require_email_verification_for_order', 'false', 'boolean', 'customer', 'Require verified email before ordering', 0),
('require_phone_verification_for_order', 'true', 'boolean', 'customer', 'Require verified phone before ordering', 0),

('same_day_order_enabled', 'false', 'boolean', 'orders', 'Allow same-day orders', 1),
('order_cutoff_hours_before_pickup', '24', 'number', 'orders', 'Order cutoff before pickup in hours', 1),
('customer_order_tracking_enabled', 'true', 'boolean', 'orders', 'Allow customers to track orders', 1),
('customer_reorder_enabled', 'true', 'boolean', 'orders', 'Allow customers to reorder', 1),
('customer_cancel_order_enabled', 'true', 'boolean', 'orders', 'Allow customer order cancellation', 1),
('customer_cancel_cutoff_hours', '24', 'number', 'orders', 'Cancellation cutoff before pickup in hours', 1),

('bulk_order_enabled', 'true', 'boolean', 'pricing', 'Enable bulk orders', 1),
('bulk_order_auto_apply', 'true', 'boolean', 'pricing', 'Auto apply bulk pricing', 0),
('bulk_order_requires_admin_approval_quantity', '20', 'number', 'pricing', 'Bulk quantity requiring admin approval', 0),

('customer_chat_enabled', 'true', 'boolean', 'chat', 'Enable customer chat', 1),
('customer_order_comments_enabled', 'true', 'boolean', 'chat', 'Allow customer order comments', 1),
('guest_order_comments_enabled', 'true', 'boolean', 'chat', 'Allow guest customer comments', 1),
('admin_internal_comments_enabled', 'true', 'boolean', 'chat', 'Allow admin internal comments', 0),
('chat_whatsapp_sync_enabled', 'true', 'boolean', 'chat', 'Enable WhatsApp sync for customer-visible chat', 0),
('internal_notes_send_to_whatsapp', 'false', 'boolean', 'chat', 'Never send internal notes to WhatsApp', 0),
('default_customer_message_channel', 'whatsapp_manual', 'string', 'chat', 'Default customer message channel', 0),

('manual_order_approval_required', 'true', 'boolean', 'orders', 'Require manual admin order approval', 0),
('payment_instructions', 'Send Interac e-Transfer with your order number as reference.', 'string', 'payments', 'Payment instruction text', 1),
('cancellation_policy_text', 'Orders can be cancelled up to 24 hours before pickup. Late cancellations must be handled directly through WhatsApp.', 'string', 'policy', 'Cancellation policy', 1),
('refund_policy_text', 'Refunds are handled case by case depending on payment status and preparation status.', 'string', 'policy', 'Refund policy', 1),
('allergen_disclaimer_text', 'Food is prepared in a shared home kitchen. We will try our best to accommodate preferences, but cross-contact cannot be fully guaranteed.', 'string', 'policy', 'Allergen disclaimer', 1);
