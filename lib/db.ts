import { getCloudflareContext } from "@opennextjs/cloudflare";
import type {
  AppSetting,
  Customer,
  D1DatabaseLike,
  D1PreparedStatement,
  Ingredient,
  MenuCategory,
  MenuAvailability,
  MenuItemIngredient,
  MenuPrice,
  MenuItem,
  Holiday,
  Order,
  OrderItem,
  PickupSlot,
  PricingRule,
  Review,
  ThaliPlan,
} from "./types";
export { formatMoney, formatPickupDate, nextPickupDate } from "./format";

type EnvWithDb = {
  DB?: D1DatabaseLike;
  EMAIL?: {
    send: (message: {
      to: string | string[];
      from: string | { email: string; name?: string };
      replyTo?: string;
      subject: string;
      text: string;
      html?: string;
    }) => Promise<{ messageId?: string }>;
  };
  ANNAPOORNA_ADMIN_PASSCODE?: string;
  ANNAPOORNA_SESSION_SECRET?: string;
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_API_VERSION?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
};

type LocalWranglerD1Database = D1DatabaseLike & {
  __localWrangler: true;
};

type LocalSqliteDatabase = {
  prepare: (query: string) => {
    all: (...values: unknown[]) => unknown[];
    get: (...values: unknown[]) => unknown;
    run: (...values: unknown[]) => { lastInsertRowid?: number | bigint };
  };
};

let runtimeEnvPromise: Promise<EnvWithDb> | null = null;
let schemaReadyPromise: Promise<void> | null = null;
let localDevDb: D1DatabaseLike | null | undefined;

function isPlainNextDevRuntime() {
  return (
    process.env.NODE_ENV === "development" &&
    !process.env.CF_PAGES &&
    !process.env.CLOUDFLARE_ACCOUNT_ID &&
    !process.env.WRANGLER
  );
}

function toPlainRow<T = unknown>(row: unknown): T {
  if (!row || typeof row !== "object") {
    return row as T;
  }
  return { ...(row as Record<string, unknown>) } as T;
}

function processEnvFallback(): EnvWithDb {
  return {
    ANNAPOORNA_ADMIN_PASSCODE: process.env.ANNAPOORNA_ADMIN_PASSCODE,
    ANNAPOORNA_SESSION_SECRET: process.env.ANNAPOORNA_SESSION_SECRET,
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:
      process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  };
}

function shouldRunRuntimeSchema(db: D1DatabaseLike) {
  return (
    Boolean((db as Partial<LocalWranglerD1Database>).__localWrangler) ||
    process.env.ANNAPOORNA_ENABLE_RUNTIME_SCHEMA === "true"
  );
}

async function loadRuntimeEnv(forceCloudflare = false): Promise<EnvWithDb> {
  if (isPlainNextDevRuntime()) {
    return processEnvFallback();
  }

  try {
    const timeoutMs =
      forceCloudflare ? 5000 : process.env.NODE_ENV === "development" ? 250 : 1500;
    const context = await Promise.race([
      getCloudflareContext({ async: true }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Cloudflare context timed out")), timeoutMs);
      }),
    ]);
    return context.env as EnvWithDb;
  } catch {
    return processEnvFallback();
  }
}

export async function getRuntimeEnv(forceCloudflare = false): Promise<EnvWithDb> {
  if (forceCloudflare && runtimeEnvPromise) {
    const env = await runtimeEnvPromise;
    if (!env.DB) {
      runtimeEnvPromise = loadRuntimeEnv(true);
    }
  }
  runtimeEnvPromise ??= loadRuntimeEnv();
  return runtimeEnvPromise;
}

export async function getDb(forceCloudflare = false): Promise<D1DatabaseLike | null> {
  const env = await getRuntimeEnv(forceCloudflare);
  if (env.DB) {
    return env.DB;
  }
  if (isPlainNextDevRuntime()) {
    localDevDb ??= await createLocalSqliteD1();
    return localDevDb;
  }
  return null;
}

export async function requireDb(): Promise<D1DatabaseLike> {
  const db = await getDb(true);
  if (!db) {
    throw new Error("D1 database binding DB is not available in this runtime.");
  }
  return db;
}

async function createLocalSqliteD1(): Promise<D1DatabaseLike | null> {
  const { existsSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const sqliteDir = join(
    process.cwd(),
    ".wrangler",
    "state",
    "v3",
    "d1",
    "miniflare-D1DatabaseObject",
  );
  if (!existsSync(sqliteDir)) {
    return null;
  }
  const sqliteFile = readdirSync(sqliteDir).find(
    (file) => file.endsWith(".sqlite") && file !== "metadata.sqlite",
  );
  if (!sqliteFile) {
    return null;
  }
  const sqliteModule = (await new Function(
    "return import('node:sqlite')",
  )()) as {
    DatabaseSync: new (path: string) => LocalSqliteDatabase;
  };
  const { DatabaseSync } = sqliteModule;
  const sqlite = new DatabaseSync(join(sqliteDir, sqliteFile));
  const localDb: LocalWranglerD1Database = {
    __localWrangler: true,
    prepare(query: string) {
      let values: unknown[] = [];
      const statement: D1PreparedStatement = {
        bind(...nextValues: unknown[]) {
          values = nextValues;
          return statement;
        },
        async all<T = unknown>() {
          const rows = sqlite.prepare(query).all(...values).map((row) => toPlainRow<T>(row));
          return {
            results: rows,
            success: true,
            meta: {},
          };
        },
        async first<T = unknown>(column?: string) {
          const row = toPlainRow<Record<string, unknown> | undefined>(
            sqlite.prepare(query).get(...values),
          );
          if (!row) {
            return null;
          }
          return (column ? row[column] : row) as T;
        },
        async run() {
          const result = sqlite.prepare(query).run(...values);
          return {
            success: true,
            meta: { last_row_id: Number(result.lastInsertRowid) || undefined },
          };
        },
      };
      return statement;
    },
  };
  return localDb;
}

async function runSchemaStatement(db: D1DatabaseLike, sql: string) {
  try {
    await db.prepare(sql).run();
  } catch {
    // Existing D1 databases may already have some columns. SQLite/D1 cannot
    // portably add columns with IF NOT EXISTS, so duplicate-column errors are
    // intentionally ignored here.
  }
}

async function ensureKitchenSchemaOnce() {
  const db = await getDb(true);
  if (!db) {
    return;
  }
  if (!shouldRunRuntimeSchema(db)) {
    return;
  }

  const alterStatements = [
    "ALTER TABLE admin_users ADD COLUMN whatsapp_number TEXT",
    "ALTER TABLE admin_users ADD COLUMN email_alert_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE admin_users ADD COLUMN whatsapp_alert_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE menu_items ADD COLUMN serving_unit TEXT NOT NULL DEFAULT 'plate'",
    "ALTER TABLE menu_items ADD COLUMN serving_definition TEXT",
    "ALTER TABLE menu_items ADD COLUMN bulk_order_eligible INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE menu_items ADD COLUMN min_bulk_quantity INTEGER",
    "ALTER TABLE menu_items ADD COLUMN max_bulk_quantity INTEGER",
    "ALTER TABLE menu_items ADD COLUMN bulk_notice_hours INTEGER NOT NULL DEFAULT 24",
    "ALTER TABLE menu_items ADD COLUMN menu_start_date TEXT",
    "ALTER TABLE menu_items ADD COLUMN menu_end_date TEXT",
    "ALTER TABLE menu_items ADD COLUMN icon_text TEXT",
    "ALTER TABLE menu_item_availability ADD COLUMN specific_date TEXT",
    "ALTER TABLE menu_item_availability ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'daily'",
    "ALTER TABLE orders ADD COLUMN fulfillment_method TEXT NOT NULL DEFAULT 'pickup'",
    "ALTER TABLE orders ADD COLUMN delivery_address TEXT",
    "ALTER TABLE orders ADD COLUMN delivery_city TEXT",
    "ALTER TABLE orders ADD COLUMN delivery_postal_code TEXT",
    "ALTER TABLE orders ADD COLUMN delivery_instructions TEXT",
    "ALTER TABLE orders ADD COLUMN allergy_notes TEXT",
    "ALTER TABLE orders ADD COLUMN order_notes TEXT",
    "ALTER TABLE orders ADD COLUMN selected_start_date TEXT",
    "ALTER TABLE orders ADD COLUMN selected_end_date TEXT",
    "ALTER TABLE orders ADD COLUMN selected_days TEXT",
    "ALTER TABLE orders ADD COLUMN total_amount REAL NOT NULL DEFAULT 0",
    "ALTER TABLE orders ADD COLUMN submission_token TEXT",
    "ALTER TABLE order_items ADD COLUMN thali_plan_id INTEGER",
    "ALTER TABLE order_items ADD COLUMN unit_price REAL NOT NULL DEFAULT 0",
    "ALTER TABLE order_items ADD COLUMN total_price REAL NOT NULL DEFAULT 0",
    "ALTER TABLE order_items ADD COLUMN order_date TEXT",
    "ALTER TABLE order_items ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE reviews ADD COLUMN order_id INTEGER",
    "ALTER TABLE reviews ADD COLUMN reviewer_contact TEXT",
    "ALTER TABLE reviews ADD COLUMN source TEXT NOT NULL DEFAULT 'portal'",
    "ALTER TABLE reviews ADD COLUMN external_review_id TEXT",
    "ALTER TABLE reviews ADD COLUMN external_review_url TEXT",
    "ALTER TABLE reviews ADD COLUMN reviewer_avatar_url TEXT",
    "ALTER TABLE reviews ADD COLUMN google_create_time TEXT",
    "ALTER TABLE reviews ADD COLUMN google_update_time TEXT",
    "ALTER TABLE reviews ADD COLUMN google_reply TEXT",
  ];

  const createStatements = [
    `CREATE TABLE IF NOT EXISTS menu_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER,
      thali_plan_id INTEGER,
      price_type TEXT NOT NULL DEFAULT 'regular',
      price_cents INTEGER NOT NULL DEFAULT 0,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS thali_plans (
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
    )`,
    `CREATE TABLE IF NOT EXISTS thali_plan_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thali_plan_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      current_stock REAL,
      minimum_stock REAL,
      cost_per_unit_cents INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS menu_item_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      quantity_required REAL NOT NULL,
      unit TEXT NOT NULL,
      quantity_basis TEXT NOT NULL DEFAULT 'per plate',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS menu_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_item_id INTEGER NOT NULL,
      day_of_week INTEGER,
      specific_date TEXT,
      start_date TEXT,
      end_date TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS order_date_change_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      old_selected_days TEXT,
      requested_selected_days TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      holiday_date TEXT NOT NULL,
      end_date TEXT,
      notice_message TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS pricing_rule_customers (
      pricing_rule_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (pricing_rule_id, customer_id)
    )`,
    `CREATE TABLE IF NOT EXISTS payment_edit_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      requested_by_admin_id INTEGER NOT NULL,
      approved_by_admin_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_payload TEXT NOT NULL,
      review_notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT
    )`,
  ];

  for (const statement of alterStatements) {
    await runSchemaStatement(db, statement);
  }
  for (const statement of createStatements) {
    await runSchemaStatement(db, statement);
  }

  await runSchemaStatement(
    db,
    "UPDATE menu_categories SET name = 'Thali' WHERE name = 'Veg Thali'",
  );
  await runSchemaStatement(
    db,
    "UPDATE menu_categories SET is_active = 0 WHERE name = 'Plan'",
  );
  await runSchemaStatement(
    db,
    `INSERT OR IGNORE INTO menu_categories (name, description, sort_order, is_active)
     VALUES ('Snacks', 'Homemade snacks and light bites', 6, 1)`,
  );
  await runSchemaStatement(
    db,
    `DELETE FROM menu_item_availability
     WHERE menu_item_id IN (
       SELECT mi.id
       FROM menu_items mi
       INNER JOIN menu_categories mc ON mc.id = mi.category_id
       WHERE mc.name = 'Breakfast'
     )`,
  );
  await runSchemaStatement(
    db,
    `INSERT INTO menu_item_availability
       (menu_item_id, availability_type, day_of_week, start_date, end_date, is_active)
     SELECT mi.id, 'weekly', days.day, NULL, NULL, 1
     FROM menu_items mi
     INNER JOIN menu_categories mc ON mc.id = mi.category_id
     CROSS JOIN (
       SELECT 0 AS day UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
       UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
     ) days
     WHERE mc.name = 'Breakfast'
       AND mi.is_active = 1
       AND mi.is_public = 1`,
  );
  await runSchemaStatement(
    db,
    `DELETE FROM menu_availability
     WHERE menu_item_id IN (
       SELECT mi.id
       FROM menu_items mi
       INNER JOIN menu_categories mc ON mc.id = mi.category_id
       WHERE mc.name = 'Breakfast'
     )`,
  );
  await runSchemaStatement(
    db,
    `INSERT INTO menu_availability
       (menu_item_id, day_of_week, start_date, end_date, active)
     SELECT mi.id, days.day, NULL, NULL, 1
     FROM menu_items mi
     INNER JOIN menu_categories mc ON mc.id = mi.category_id
     CROSS JOIN (
       SELECT 0 AS day UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
       UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
     ) days
     WHERE mc.name = 'Breakfast'
       AND mi.is_active = 1
       AND mi.is_public = 1`,
  );
  await runSchemaStatement(
    db,
    `UPDATE admin_users
     SET whatsapp_number = '+13685992299',
         email_alert_enabled = COALESCE(email_alert_enabled, 1),
         whatsapp_alert_enabled = COALESCE(whatsapp_alert_enabled, 1)
     WHERE email = 'ratheesh.ramadasan@gmail.com'`,
  );
  await runSchemaStatement(
    db,
    `UPDATE admin_users
     SET whatsapp_number = '+14034814101',
         email_alert_enabled = COALESCE(email_alert_enabled, 1),
         whatsapp_alert_enabled = COALESCE(whatsapp_alert_enabled, 1)
     WHERE email = 'lachureshmi6@gmail.com'`,
  );

  await runSchemaStatement(
    db,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_submission_token ON orders(submission_token)",
  );

  await runSchemaStatement(
    db,
    `INSERT OR IGNORE INTO menu_prices (menu_item_id, price_type, price_cents, effective_from, active)
     SELECT id, 'regular', base_price_cents, date('now'), 1
     FROM menu_items
     WHERE base_price_cents > 0`,
  );

  const settings = [
    ["delivery_enabled", "false", "boolean"],
    ["delivery_fee", "0", "number"],
    ["delivery_min_order_amount", "0", "number"],
    ["delivery_service_area_note", "", "string"],
    ["public_allow_reviews", "true", "boolean"],
    ["google_review_url", "", "string"],
    ["google_reviews_sync_enabled", "false", "boolean"],
    ["google_account_id", "", "string"],
    ["google_location_id", "", "string"],
    ["google_reviews_last_sync_at", "", "string"],
    ["google_reviews_last_sync_status", "", "string"],
    ["brand_font_family", "aptos", "string"],
    ["brand_display_font", "cambria", "string"],
    ["brand_font_scale", "100", "number"],
    ["brand_background_theme", "cream_gold", "string"],
    ["brand_background_image_url", "", "string"],
    ["brand_icon_url", "/assets/brand-mark.jpg", "string"],
    ["payment_edit_second_admin_approval_enabled", "false", "boolean"],
    ["home_menu_lines", defaultHomeContent.menu.join("\\n"), "text"],
    ["home_pickup_lines", defaultHomeContent.pickup.join("\\n"), "text"],
    ["home_perfect_for_lines", defaultHomeContent.perfectFor.join("\\n"), "text"],
    [
      "order_customer_message_template",
      "Hi {customer_name},\\n\\nYour Annapoorna order {order_number} has been received for {date}.\\nTrack your order here: {link}\\n\\n{admin_signature}",
      "text",
    ],
    [
      "order_admin_message_template",
      "New Annapoorna order {order_number}\\nCustomer: {customer_name}\\nDate: {date}\\nLink: {link}\\n\\n{admin_signature}",
      "text",
    ],
    ["portal_admin_signature", "Regards,\\nTeam Annapoorna", "text"],
    ["notification_from_email", "", "string"],
    ["notification_from_name", "Annapoorna", "string"],
  ];
  for (const [key, value, type] of settings) {
    try {
      await db
        .prepare(
          `INSERT OR IGNORE INTO app_settings
           (key, value, value_type, category, description, is_public)
           VALUES (?, ?, ?, ?, ?, 1)`,
        )
        .bind(
          key,
          value.replace(/\\n/g, "\n"),
          type,
          key.startsWith("home_")
            ? "home"
            : key.startsWith("order_") || key === "portal_admin_signature"
              ? "notifications"
              : "fulfillment",
          key,
        )
        .run();
    } catch {
      // Ignore older local schema setup failures; normal reads still use fallbacks.
    }
  }
}

export async function ensureKitchenSchema() {
  schemaReadyPromise ??= ensureKitchenSchemaOnce().catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });
  return schemaReadyPromise;
}

export async function all<T>(query: string, values: unknown[] = []): Promise<T[]> {
  const db = await getDb(true);
  if (!db) {
    return [];
  }
  const statement = db.prepare(query).bind(...values);
  const result = await statement.all<T>();
  return result.results ?? [];
}

export async function first<T>(
  query: string,
  values: unknown[] = [],
): Promise<T | null> {
  const db = await getDb(true);
  if (!db) {
    return null;
  }
  return db.prepare(query).bind(...values).first<T>();
}

export async function getSettings(): Promise<Record<string, string>> {
  await ensureKitchenSchema();
  const rows = await all<AppSetting>(
    "SELECT key, value, value_type FROM app_settings",
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export const defaultHomeContent = {
  menu: [
    "Rice, chapathi, sabji, curd and pickle",
    "One weekday curry from the curry list",
    "Non-veg option with chicken fry or pepper chicken",
    "Sunday idli, sambar and coconut chutney",
  ],
  pickup: [
    "72 Amblehurst GDNS NW",
    "Calgary, AB",
    "Weekday/Saturday pickup: 12:00 PM",
    "Sunday breakfast pickup: 10:00 AM",
    "Pre-order required",
  ],
  perfectFor: [
    "Students",
    "Office staff",
    "Working professionals",
    "Families and guests",
  ],
};

function settingLines(settings: Record<string, string>, key: string, fallback: string[]) {
  const value = settings[key];
  if (!value) {
    return fallback;
  }
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : fallback;
}

function safeMenuImageUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value;
}

export async function getHomeContent() {
  let settings: Record<string, string> = {};
  try {
    settings = await getSettings();
  } catch (error) {
    console.error("Unable to load homepage settings; using defaults.", error);
  }

  return {
    menu: settingLines(settings, "home_menu_lines", defaultHomeContent.menu),
    pickup: settingLines(settings, "home_pickup_lines", defaultHomeContent.pickup),
    perfectFor: settingLines(
      settings,
      "home_perfect_for_lines",
      defaultHomeContent.perfectFor,
    ),
  };
}

export function settingBool(
  settings: Record<string, string>,
  key: string,
  fallback: boolean,
) {
  const value = settings[key];
  if (value === undefined) {
    return fallback;
  }
  return value === "true" || value === "1";
}

export function settingNumber(
  settings: Record<string, string>,
  key: string,
  fallback: number,
) {
  const value = Number(settings[key]);
  return Number.isFinite(value) ? value : fallback;
}

export async function getPublicMenu() {
  await ensureKitchenSchema();
  const [categories, items, availability, prices, thaliPlans, pricingRules, pickupSlots, holidays, settings] =
    await Promise.all([
      all<MenuCategory>(
        `SELECT id, name, description, sort_order, is_active
         FROM menu_categories
         WHERE is_active = 1
         ORDER BY sort_order ASC, name ASC`,
      ),
      all<MenuItem>(
        `SELECT
           mi.id,
           mi.category_id,
           mc.name AS category_name,
           mi.name,
           mi.description,
           mi.food_type,
           mi.base_price_cents,
           mi.image_url,
           mi.is_active,
           mi.is_public,
           mi.public_sold_out,
           mi.sort_order,
           mi.serving_unit,
           mi.serving_definition,
           mi.bulk_order_eligible,
           mi.min_bulk_quantity,
           mi.max_bulk_quantity,
           mi.bulk_notice_hours,
           mi.menu_start_date,
           mi.menu_end_date
         FROM menu_items mi
         LEFT JOIN menu_categories mc ON mc.id = mi.category_id
         WHERE mi.is_active = 1 AND mi.is_public = 1
         ORDER BY COALESCE(mc.sort_order, 99), mi.sort_order, mi.name`,
      ),
      all<MenuAvailability>(
        `SELECT *
         FROM menu_item_availability
         WHERE is_active = 1
         ORDER BY menu_item_id, day_of_week`,
      ),
      all<MenuPrice>(
        `SELECT *
         FROM menu_prices
         WHERE active = 1
         ORDER BY effective_from DESC`,
      ),
      all<ThaliPlan>(
        `SELECT *
         FROM thali_plans
         WHERE active = 1
         ORDER BY plan_type, name`,
      ),
      all<PricingRule>(
        `SELECT *
         FROM pricing_rules
         WHERE is_active = 1 AND is_public = 1
         ORDER BY priority DESC, minimum_quantity ASC, name ASC`,
      ),
      all<PickupSlot>(
        `SELECT id, name, day_of_week, start_time, end_time, max_orders, max_quantity, sort_order
         FROM pickup_slots
         WHERE is_active = 1
         ORDER BY sort_order ASC, day_of_week ASC, start_time ASC`,
      ),
      all<Holiday>(
        `SELECT id, name, holiday_date, end_date, notice_message, is_active, created_at
         FROM holidays
         WHERE is_active = 1
         ORDER BY holiday_date ASC, name ASC`,
      ),
      getSettings(),
    ]);

  return {
    categories,
    items: items.map((item) => ({
      ...item,
      image_url: safeMenuImageUrl(item.image_url),
    })),
    availability,
    prices,
    thaliPlans,
    pricingRules,
    pickupSlots,
    holidays,
    settings,
  };
}

export async function getAdminMenuData() {
  await ensureKitchenSchema();
  const [categories, items, availability, prices, ingredients, recipes] =
    await Promise.all([
      all<MenuCategory>(
        `SELECT *
         FROM menu_categories
         WHERE id IN (SELECT MIN(id) FROM menu_categories GROUP BY lower(name))
         ORDER BY sort_order, name`,
      ),
      all<MenuItem>(
        `SELECT
           mi.id,
           mi.category_id,
           mc.name AS category_name,
           mi.name,
           mi.description,
           mi.food_type,
           mi.base_price_cents,
           mi.image_url,
           mi.is_active,
           mi.is_public,
           mi.public_sold_out,
           mi.sort_order,
           mi.serving_unit,
           mi.serving_definition,
           mi.bulk_order_eligible,
           mi.min_bulk_quantity,
           mi.max_bulk_quantity,
           mi.bulk_notice_hours,
           mi.menu_start_date,
           mi.menu_end_date
         FROM menu_items mi
         LEFT JOIN menu_categories mc ON mc.id = mi.category_id
         ORDER BY COALESCE(mc.sort_order, 99), mi.sort_order, mi.name`,
      ),
      all<MenuAvailability>(
        "SELECT * FROM menu_item_availability WHERE is_active = 1 ORDER BY menu_item_id, day_of_week",
      ),
      all<MenuPrice>(
        `SELECT *
         FROM menu_prices
         WHERE active = 1
         ORDER BY menu_item_id, price_type, effective_to IS NOT NULL, effective_from DESC, id DESC`,
      ),
      all<Ingredient>(
        "SELECT * FROM ingredients WHERE active = 1 ORDER BY name",
      ),
      all<MenuItemIngredient>(
        `SELECT mii.*, i.name AS ingredient_name
         FROM menu_item_ingredients mii
         JOIN ingredients i ON i.id = mii.ingredient_id
         ORDER BY mii.menu_item_id, i.name`,
      ),
    ]);

  return {
    categories,
    items: items.map((item) => ({
      ...item,
      image_url: safeMenuImageUrl(item.image_url),
    })),
    availability,
    prices,
    ingredients,
    recipes,
  };
}

export async function getOrderByNumber(orderNumber: string) {
  const lookup = orderNumber.trim();
  const numericId = /^\d+$/.test(lookup) ? Number(lookup) : null;
  const order = numericId
    ? await first<Order>(
        `SELECT *
         FROM orders
         WHERE order_number = ? OR id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [lookup, numericId],
      )
    : await first<Order>(
        `SELECT *
         FROM orders
         WHERE order_number = ?
         ORDER BY id DESC
         LIMIT 1`,
        [lookup],
      );
  if (!order) {
    return null;
  }
  const items = await all<OrderItem>(
    `SELECT *
     FROM order_items
     WHERE order_id = ?
     ORDER BY id ASC`,
    [order.id],
  );
  return { order, items };
}

export async function getOrderForLookup(
  orderNumber: string,
  emailOrPhone: string,
) {
  const lookup = emailOrPhone.trim().toLowerCase();
  const data = await getOrderByNumber(orderNumber);
  if (!data) {
    return null;
  }
  const email = data.order.customer_email?.toLowerCase() ?? "";
  const phone = data.order.customer_phone.replace(/\D/g, "");
  const normalizedLookup = lookup.replace(/\D/g, "");
  if (email === lookup || (normalizedLookup && phone.endsWith(normalizedLookup))) {
    return data;
  }
  return null;
}

export async function getApprovedReviews() {
  return all<Review>(
    `SELECT id, customer_name, rating, comment, moderation_status, created_at,
            source, external_review_url, google_update_time
     FROM reviews
     WHERE moderation_status = 'approved'
     ORDER BY COALESCE(google_update_time, created_at) DESC
     LIMIT 100`,
  );
}

export async function getCustomerByLogin(emailOrPhone: string) {
  const raw = emailOrPhone.trim();
  const phone = raw.replace(/[^\d+]/g, "");
  return first<Customer>(
    `SELECT *
     FROM customers
     WHERE lower(email) = lower(?) OR phone = ?
     LIMIT 1`,
    [raw, phone || raw],
  );
}

export async function syncCustomerDirectoryFromOrders() {
  const db = await requireDb();
  const unlinkedOrders = await all<{
    id: number;
    customer_name: string;
    customer_email: string | null;
    customer_phone: string;
  }>(
    `SELECT id, customer_name, customer_email, customer_phone
     FROM orders
     WHERE customer_id IS NULL
       AND customer_phone IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 500`,
  );

  for (const order of unlinkedOrders) {
    let customer = order.customer_email
      ? await db
          .prepare(
            `SELECT id
             FROM customers
             WHERE lower(email) = lower(?) OR phone = ?
             LIMIT 1`,
          )
          .bind(order.customer_email, order.customer_phone)
          .first<{ id: number }>()
      : await db
          .prepare("SELECT id FROM customers WHERE phone = ? LIMIT 1")
          .bind(order.customer_phone)
          .first<{ id: number }>();

    if (!customer) {
      try {
        const result = await db
          .prepare(
            `INSERT INTO customers
             (full_name, email, phone, status, consent_timestamp)
             VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
          )
          .bind(order.customer_name, order.customer_email, order.customer_phone)
          .run();
        customer = result.meta.last_row_id ? { id: result.meta.last_row_id } : null;
      } catch {
        customer = await db
          .prepare("SELECT id FROM customers WHERE phone = ? LIMIT 1")
          .bind(order.customer_phone)
          .first<{ id: number }>();
      }
    }

    if (customer) {
      await db
        .prepare("UPDATE orders SET customer_id = ? WHERE id = ?")
        .bind(customer.id, order.id)
        .run();
    }
  }

  await db
    .prepare(
      `UPDATE payments
       SET customer_id = (
         SELECT customer_id FROM orders WHERE orders.id = payments.order_id
       )
       WHERE customer_id IS NULL
         AND order_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.customer_id IS NOT NULL
         )`,
    )
    .run();

  await db
    .prepare(
      `UPDATE customers
       SET
         order_count = (
           SELECT COUNT(*)
           FROM orders
           WHERE orders.customer_id = customers.id
             AND orders.status NOT IN ('cancelled')
         ),
         total_spent_cents = (
           SELECT COALESCE(SUM(received_amount_cents), 0)
           FROM payments
           WHERE payments.customer_id = customers.id
             AND payments.payment_status IN ('partial', 'paid', 'verified')
         ),
         last_order_at = (
           SELECT MAX(created_at)
           FROM orders
           WHERE orders.customer_id = customers.id
         ),
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run();
}

export async function getCustomerOrders(customerId: number) {
  return all<Order>(
    `SELECT *
     FROM orders
     WHERE customer_id = ?
     ORDER BY created_at DESC`,
    [customerId],
  );
}

export async function getCustomerOrderHistory(customer: Customer) {
  return all<Order>(
    `SELECT *
     FROM orders
     WHERE customer_id = ?
        OR (customer_email IS NOT NULL AND lower(customer_email) = lower(?))
        OR customer_phone = ?
     ORDER BY created_at DESC`,
    [customer.id, customer.email ?? "", customer.phone],
  );
}
