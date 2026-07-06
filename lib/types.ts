export type D1Result<T> = {
  results?: T[];
  success?: boolean;
  meta?: unknown;
};

export type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  first: <T = unknown>(column?: string) => Promise<T | null>;
  all: <T = unknown>() => Promise<D1Result<T>>;
  run: () => Promise<{ success: boolean; meta: { last_row_id?: number } }>;
};

export type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement;
  batch?: (
    statements: D1PreparedStatement[],
  ) => Promise<Array<{ success: boolean }>>;
};

export type AppSetting = {
  key: string;
  value: string;
  value_type: "string" | "boolean" | "number";
};

export type MenuCategory = {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: number;
};

export type MenuItem = {
  id: number;
  category_id: number | null;
  category_name: string | null;
  name: string;
  description: string | null;
  food_type: string;
  base_price_cents: number;
  image_url: string | null;
  is_active: number;
  is_public: number;
  public_sold_out: number;
  sort_order: number;
  serving_unit: string;
  serving_definition: string | null;
  bulk_order_eligible: number;
  min_bulk_quantity: number | null;
  max_bulk_quantity: number | null;
  bulk_notice_hours: number;
  menu_start_date: string | null;
  menu_end_date: string | null;
  effective_price_cents?: number;
  bulk_price_cents?: number | null;
  availability_days?: string | null;
};

export type MenuAvailability = {
  id: number;
  menu_item_id: number;
  availability_type: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
};

export type MenuPrice = {
  id: number;
  menu_item_id: number | null;
  thali_plan_id: number | null;
  price_type: "regular" | "bulk" | "subscription";
  price_cents: number;
  effective_from: string;
  effective_to: string | null;
  active: number;
};

export type ThaliPlan = {
  id: number;
  name: string;
  description: string | null;
  plan_type: "daily" | "weekly" | "monthly";
  active: number;
  available_days: string | null;
  start_date: string | null;
  end_date: string | null;
  effective_price_cents?: number;
};

export type Ingredient = {
  id: number;
  name: string;
  unit: string;
  current_stock: number | null;
  minimum_stock: number | null;
  cost_per_unit_cents: number | null;
  active: number;
};

export type MenuItemIngredient = {
  id: number;
  menu_item_id: number;
  ingredient_id: number;
  ingredient_name: string;
  quantity_required: number;
  unit: string;
  quantity_basis: string;
};

export type PricingRule = {
  id: number;
  name: string;
  description: string | null;
  rule_type: string;
  pricing_method: string;
  applies_to: string;
  menu_item_id: number | null;
  category_id: number | null;
  minimum_quantity: number;
  discount_percent: number | null;
  discount_amount_cents: number | null;
  fixed_unit_price_cents: number | null;
  fixed_total_price_cents: number | null;
  is_bulk_order: number;
  requires_admin_approval: number;
  is_public: number;
  auto_apply: number;
  is_active: number;
  start_date: string | null;
  end_date: string | null;
};

export type PickupSlot = {
  id: number;
  name: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  max_orders: number | null;
  max_quantity: number | null;
  sort_order: number;
};

export type Order = {
  id: number;
  order_number: string;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  order_type: string;
  fulfillment_method: string;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_postal_code: string | null;
  delivery_instructions: string | null;
  allergy_notes: string | null;
  selected_start_date: string | null;
  selected_end_date: string | null;
  selected_days: string | null;
  pickup_date: string;
  pickup_time: string;
  pickup_slot_id: number | null;
  status: string;
  customer_facing_status: string;
  subtotal_cents: number;
  discount_total_cents: number;
  tax_total_cents: number;
  total_cents: number;
  payment_status: string;
  requires_admin_approval: number;
  customer_notes: string | null;
  created_at: string;
};

export type OrderItem = {
  id: number;
  order_id: number;
  menu_item_id: number | null;
  thali_plan_id: number | null;
  item_name_snapshot: string;
  item_description_snapshot: string | null;
  quantity: number;
  unit_price_cents: number;
  unit_price: number;
  line_subtotal_cents: number;
  line_discount_cents: number;
  line_total_cents: number;
  total_price: number;
  order_date: string | null;
};

export type Review = {
  id: number;
  order_id?: number | null;
  reviewer_contact?: string | null;
  customer_name: string;
  rating: number;
  comment: string;
  moderation_status: string;
  created_at: string;
};

export type Customer = {
  id: number;
  full_name: string;
  email: string | null;
  phone: string;
  status: string;
  order_count: number;
  total_spent_cents: number;
  last_order_at: string | null;
  created_at: string;
};
