"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  clearAdminSession,
  clearCustomerSession,
  getCustomerSession,
  requireAdminSession,
  setAdminSession,
  setCustomerSession,
} from "@/lib/auth";
import {
  effectivePrice,
  isMenuItemAvailableOn,
  isThaliPlanAvailableOn,
  type OrderType,
} from "@/lib/order-utils";
import {
  getCustomerByLogin,
  getOrderForLookup,
  getRuntimeEnv,
  ensureKitchenSchema,
  requireDb,
  settingBool,
  settingNumber,
} from "@/lib/db";
import type {
  D1DatabaseLike,
  MenuAvailability,
  MenuItem,
  MenuPrice,
  PricingRule,
  ThaliPlan,
} from "@/lib/types";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function sanitizeRichText(value: string | null) {
  if (!value) {
    return null;
  }
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\s(?:href|src)="javascript:[^"]*"/gi, "")
    .replace(/\s(?:href|src)='javascript:[^']*'/gi, "")
    .replace(
      /<\/?(?!b|strong|i|em|u|br|p|div|ul|ol|li|span)([a-z][a-z0-9-]*)(?:\s[^>]*)?>/gi,
      "",
    )
    .replace(/<(b|strong|i|em|u|br|p|div|ul|ol|li|span)(?:\s[^>]*)?>/gi, "<$1>")
    .trim() || null;
}

function normalizeStoredImageUrl(value: string | null) {
  if (!value) {
    return null;
  }
  if (value.startsWith("data:image") || value.length > 500) {
    return "/assets/veg-thali.png";
  }
  return value;
}

function adminOrdersRedirect(formData: FormData, saved: string) {
  const params = new URLSearchParams({ saved });
  const from = optionalString(formData, "from");
  const to = optionalString(formData, "to");
  if (from) {
    params.set("from", from);
  }
  if (to) {
    params.set("to", to);
  }
  redirect(`/admin/orders?${params.toString()}`);
}

function orderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AN-${stamp}-${suffix}`;
}

function reviewToken() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sqliteDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function customerFacingOrderStatus(status: string) {
  const labels: Record<string, string> = {
    pending_approval: "Pending approval",
    pending: "Order received",
    approved: "Approved",
    preparing: "Preparing",
    ready: "Ready for pickup",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function dateFromValue(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDaysToValue(dateValue: string, daysToAdd: number) {
  const date = dateFromValue(dateValue);
  date.setDate(date.getDate() + daysToAdd);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validatePlanDates(
  orderType: OrderType,
  selectedStartDate: string,
  selectedDays: string | null,
) {
  if (orderType !== "weekly" && orderType !== "monthly") {
    return;
  }
  const selected = (selectedDays ?? "")
    .split(",")
    .map((day) => day.trim())
    .filter(Boolean);
  const maxDays = orderType === "weekly" ? 5 : 20;
  const endDate = addDaysToValue(selectedStartDate, orderType === "weekly" ? 13 : 39);
  if (selected.length === 0) {
    throw new Error("Please choose delivery dates for this thali plan.");
  }
  if (selected.length > maxDays) {
    throw new Error(`${orderType === "weekly" ? "Weekly" : "Monthly"} thali allows up to ${maxDays} weekdays.`);
  }
  for (const dateValue of selected) {
    const date = dateFromValue(dateValue);
    const day = date.getDay();
    if (dateValue < selectedStartDate || dateValue > endDate || day === 0 || day === 6) {
      throw new Error("Selected plan dates must be weekdays inside the plan window.");
    }
  }
}

async function activeHolidayForDate(db: D1DatabaseLike, dateValue: string) {
  return db
    .prepare(
      `SELECT id, name, holiday_date, end_date, notice_message
       FROM holidays
       WHERE is_active = 1
         AND holiday_date <= ?
         AND COALESCE(end_date, holiday_date) >= ?
       ORDER BY holiday_date ASC
       LIMIT 1`,
    )
    .bind(dateValue, dateValue)
    .first<{
      id: number;
      name: string;
      holiday_date: string;
      end_date: string | null;
      notice_message: string | null;
    }>();
}

async function validateHolidayDates(
  db: D1DatabaseLike,
  selectedStartDate: string,
  selectedDays: string | null,
) {
  const dates = [selectedStartDate, ...(selectedDays ?? "").split(",")]
    .map((date) => date.trim())
    .filter(Boolean);
  for (const date of new Set(dates)) {
    const holiday = await activeHolidayForDate(db, date);
    if (holiday) {
      throw new Error(`${holiday.name} is blocked for ordering on ${date}. Please choose another date.`);
    }
  }
}

async function refreshCustomerRollup(db: D1DatabaseLike, customerId: number) {
  await db
    .prepare(
      `UPDATE customers
       SET
         order_count = (
           SELECT COUNT(*)
           FROM orders
           WHERE customer_id = ?
             AND status NOT IN ('cancelled')
         ),
         total_spent_cents = (
           SELECT COALESCE(SUM(received_amount_cents), 0)
           FROM payments
           WHERE customer_id = ?
             AND payment_status IN ('paid', 'verified')
         ),
         last_order_at = (
           SELECT MAX(created_at)
           FROM orders
           WHERE customer_id = ?
         ),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(customerId, customerId, customerId, customerId)
    .run();
}

async function upsertCustomerForOrder(
  db: D1DatabaseLike,
  customerName: string,
  customerEmail: string | null,
  customerPhone: string,
) {
  const normalizedPhone = normalizePhone(customerPhone) || customerPhone;
  const existing = customerEmail
    ? await db
        .prepare(
          `SELECT id
           FROM customers
           WHERE lower(email) = lower(?) OR phone = ?
           ORDER BY CASE WHEN lower(email) = lower(?) THEN 0 ELSE 1 END
           LIMIT 1`,
        )
        .bind(customerEmail, normalizedPhone, customerEmail)
        .first<{ id: number }>()
    : await db
        .prepare("SELECT id FROM customers WHERE phone = ? LIMIT 1")
        .bind(normalizedPhone)
        .first<{ id: number }>();

  if (existing) {
    await db
      .prepare(
        `UPDATE customers
         SET full_name = ?,
             email = COALESCE(email, ?),
             phone = ?,
             status = CASE WHEN status = 'pending_verification' THEN 'active' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(customerName, customerEmail, normalizedPhone, existing.id)
      .run();
    return existing.id;
  }

  const result = await db
    .prepare(
      `INSERT INTO customers
       (full_name, email, phone, status, consent_timestamp)
       VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
    )
    .bind(customerName, customerEmail, normalizedPhone)
    .run();
  const customerId = result.meta.last_row_id;
  if (!customerId) {
    throw new Error("Customer could not be created.");
  }
  return customerId;
}

async function runOptionalMutation(
  db: D1DatabaseLike,
  query: string,
  values: unknown[] = [],
) {
  try {
    await db.prepare(query).bind(...values).run();
  } catch {
    // Older local D1 databases may not have every supporting table yet.
  }
}

const defaultCustomerOrderMessage = [
  "Hi {customer_name},",
  "",
  "Your Annapoorna order {order_number} has been received for {date}.",
  "Track your order here: {link}",
  "",
  "{admin_signature}",
].join("\n");

const defaultAdminOrderMessage = [
  "New Annapoorna order {order_number}",
  "Customer: {customer_name}",
  "Date: {date}",
  "Link: {link}",
  "",
  "{admin_signature}",
].join("\n");

function renderOrderNotificationTemplate(
  template: string | undefined,
  fallback: string,
  fields: Record<string, string>,
) {
  const source = template?.trim() || fallback;
  const replacements: Record<string, string> = {
    ...fields,
    signature: fields.admin_signature ?? "",
  };
  return source.replace(/\{([a-z_]+)\}/gi, (match, key: string) => {
    const value = replacements[key.toLowerCase()];
    return value ?? match;
  });
}

async function queueAdminNewOrderWhatsApp(
  db: D1DatabaseLike,
  settings: Record<string, string>,
  order: {
    id: number;
    orderNumber: string;
    customerId: number;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    pickupDate: string;
    pickupTime: string;
    totalCents: number;
  },
) {
  const adminResult = await db
    .prepare(
      `SELECT email, whatsapp_number, email_alert_enabled, whatsapp_alert_enabled
       FROM admin_users
       WHERE status = 'approved'`,
    )
    .all<{
      email: string;
      whatsapp_number: string | null;
      email_alert_enabled: number | null;
      whatsapp_alert_enabled: number | null;
    }>();
  const admins = adminResult.results ?? [];
  const fallbackWhatsapp = settings.business_whatsapp_number?.trim();
  const recipients = admins.flatMap((admin) => {
    const rows: Array<{ channel: string; value: string; label: string }> = [];
    if (admin.email_alert_enabled === 1) {
      rows.push({ channel: "email", value: admin.email, label: admin.email });
    }
    if (admin.whatsapp_alert_enabled === 1 && admin.whatsapp_number?.trim()) {
      rows.push({
        channel: "whatsapp",
        value: admin.whatsapp_number.replace(/\s+/g, ""),
        label: admin.email,
      });
    }
    return rows;
  });
  if (recipients.length === 0 && fallbackWhatsapp) {
    recipients.push({
      channel: "whatsapp",
      value: fallbackWhatsapp.replace(/\s+/g, ""),
      label: "business",
    });
  }
  if (recipients.length === 0) {
    return;
  }

  const totalText = `$${(order.totalCents / 100).toFixed(2)}`;
  const contact = [order.customerPhone, order.customerEmail].filter(Boolean).join(" / ");
  const adminUrl = `${await currentOrigin()}/admin/orders`;
  const message = renderOrderNotificationTemplate(
    settings.order_admin_message_template,
    defaultAdminOrderMessage,
    {
      admin_signature: settings.portal_admin_signature ?? "",
      contact,
      customer_name: order.customerName,
      date: `${order.pickupDate} ${order.pickupTime}`.trim(),
      link: adminUrl,
      order_number: order.orderNumber,
      total: totalText,
    },
  );

  for (const recipient of recipients) {
    await db
      .prepare(
        `INSERT INTO notifications
         (notification_type, channel, recipient_type, recipient_value, customer_id, order_id, subject, message, status)
         VALUES ('new_order_admin', ?, 'admin', ?, ?, ?, ?, ?, 'pending')`,
      )
      .bind(
        recipient.channel,
        recipient.value,
        order.customerId,
        order.id,
        `New Annapoorna order for ${recipient.label}`,
        message,
      )
      .run();
  }
}

async function currentOrigin() {
  const headerStore = await headers();
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

async function queueCustomerOrderTrackingNotifications(
  db: D1DatabaseLike,
  settings: Record<string, string>,
  order: {
    id: number;
    orderNumber: string;
    customerId: number;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    pickupDate: string;
    pickupTime: string;
    status: string;
  },
) {
  const trackUrl = `${await currentOrigin()}/track-order?order=${encodeURIComponent(
    order.orderNumber,
  )}&found=1`;
  const message = renderOrderNotificationTemplate(
    settings.order_customer_message_template,
    defaultCustomerOrderMessage,
    {
      admin_signature: settings.portal_admin_signature ?? "",
      customer_name: order.customerName,
      date: `${order.pickupDate} ${order.pickupTime}`.trim(),
      link: trackUrl,
      order_number: order.orderNumber,
      status: order.status,
    },
  );
  const notifications: Array<{ channel: "email" | "whatsapp"; recipient: string; subject: string }> = [];

  if (order.customerEmail) {
    notifications.push({
      channel: "email",
      recipient: order.customerEmail,
      subject: `Annapoorna order ${order.orderNumber}`,
    });
  }
  if (order.customerPhone) {
    notifications.push({
      channel: "whatsapp",
      recipient: normalizePhone(order.customerPhone),
      subject: `Annapoorna order ${order.orderNumber}`,
    });
  }

  for (const notification of notifications) {
    await db
      .prepare(
        `INSERT INTO notifications
         (notification_type, channel, recipient_type, recipient_value, customer_id, order_id, subject, message, status)
         VALUES ('order_tracking_link', ?, 'customer', ?, ?, ?, ?, ?, 'pending')`,
      )
      .bind(
        notification.channel,
        notification.recipient,
        order.customerId,
        order.id,
        notification.subject,
        message,
      )
      .run();
  }
}

function datesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA <= endB && startB <= endA;
}

async function affectedOrdersForHoliday(
  db: D1DatabaseLike,
  startDate: string,
  endDate: string,
) {
  const result = await db
    .prepare(
      `SELECT id, order_number, customer_id, customer_name, customer_email, customer_phone,
              pickup_date, pickup_time, selected_days, total_cents, payment_status, status
       FROM orders
       WHERE status NOT IN ('cancelled')
         AND (
           pickup_date BETWEEN ? AND ?
           OR selected_days IS NOT NULL
         )
       ORDER BY pickup_date ASC, created_at ASC`,
    )
    .bind(startDate, endDate)
    .all<{
      id: number;
      order_number: string;
      customer_id: number | null;
      customer_name: string;
      customer_email: string | null;
      customer_phone: string;
      pickup_date: string;
      pickup_time: string;
      selected_days: string | null;
      total_cents: number;
      payment_status: string;
      status: string;
    }>();

  return (result.results ?? []).filter((order) => {
    if (datesOverlap(order.pickup_date, order.pickup_date, startDate, endDate)) {
      return true;
    }
    return (order.selected_days ?? "")
      .split(",")
      .map((date) => date.trim())
      .filter(Boolean)
      .some((date) => date >= startDate && date <= endDate);
  });
}

async function queueHolidayNotices(
  db: D1DatabaseLike,
  holiday: {
    name: string;
    holidayDate: string;
    endDate: string;
    noticeMessage: string | null;
  },
) {
  const orders = await affectedOrdersForHoliday(db, holiday.holidayDate, holiday.endDate);
  const dateText =
    holiday.holidayDate === holiday.endDate
      ? holiday.holidayDate
      : `${holiday.holidayDate} to ${holiday.endDate}`;

  for (const order of orders) {
    const trackUrl = `${await currentOrigin()}/track-order?order=${encodeURIComponent(
      order.order_number,
    )}&found=1`;
    const message =
      holiday.noticeMessage?.trim() ||
      [
        `Hi ${order.customer_name},`,
        "",
        `Annapoorna is closed for ${holiday.name} on ${dateText}. Your booking ${order.order_number} may be affected.`,
        `Track your order here: ${trackUrl}`,
        "",
        "Regards,",
        "Team Annapoorna",
      ].join("\n");
    const recipients: Array<{ channel: "email" | "whatsapp"; value: string }> = [];
    if (order.customer_email) {
      recipients.push({ channel: "email", value: order.customer_email });
    }
    if (order.customer_phone) {
      recipients.push({ channel: "whatsapp", value: normalizePhone(order.customer_phone) });
    }
    for (const recipient of recipients) {
      await db
        .prepare(
          `INSERT INTO notifications
           (notification_type, channel, recipient_type, recipient_value, customer_id, order_id, subject, message, status)
           VALUES ('holiday_notice', ?, 'customer', ?, ?, ?, ?, ?, 'pending')`,
        )
        .bind(
          recipient.channel,
          recipient.value,
          order.customer_id,
          order.id,
          `Annapoorna holiday notice for ${order.order_number}`,
          message,
        )
        .run();
    }
  }
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashAdminPassword(password: string, saltHex: string) {
  const salt = new TextEncoder().encode(saltHex);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: 100000,
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function ensureAdminPasswordColumns() {
  const db = await requireDb();
  for (const columnSql of [
    "ALTER TABLE admin_users ADD COLUMN password_hash TEXT",
    "ALTER TABLE admin_users ADD COLUMN password_salt TEXT",
    "ALTER TABLE admin_users ADD COLUMN whatsapp_number TEXT",
    "ALTER TABLE admin_users ADD COLUMN email_alert_enabled INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE admin_users ADD COLUMN whatsapp_alert_enabled INTEGER NOT NULL DEFAULT 1",
  ]) {
    try {
      await db.prepare(columnSql).run();
    } catch {
      // Column already exists. D1/SQLite ALTER TABLE has no portable IF NOT EXISTS.
    }
  }
  await db
    .prepare(
      `INSERT OR IGNORE INTO admin_users (email, name, role, status, approved_at)
       VALUES ('ratheesh.ramadasan@gmail.com', 'Ratheesh Ramadasan', 'owner', 'approved', CURRENT_TIMESTAMP)`,
    )
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO admin_users (email, name, role, status, approved_at)
       VALUES ('lachureshmi6@gmail.com', 'Reshmi', 'owner', 'approved', CURRENT_TIMESTAMP)`,
    )
    .run();
  await db
    .prepare(
      `UPDATE admin_users
       SET password_salt = '7174f92079ac67cf85fa29132122a42b',
           password_hash = 'f9538e7d682ddfb75b468e829d96a7f38f03cb14e3fa7cf550bb21f22ebe3067',
           whatsapp_number = '+13685992299',
           email_alert_enabled = 1,
           whatsapp_alert_enabled = 1,
           status = 'approved',
           updated_at = CURRENT_TIMESTAMP
       WHERE email = 'ratheesh.ramadasan@gmail.com'`,
    )
    .run();
  await db
    .prepare(
      `UPDATE admin_users
       SET password_salt = 'e57f687a4e2b447c694b68a4ca8d2d83',
           password_hash = 'c60931b8a6a9cb438bb612efc8b2f20ac702bd3004020a706ed6d39d7d2a3a08',
           whatsapp_number = '+14034814101',
           email_alert_enabled = 1,
           whatsapp_alert_enabled = 1,
           status = 'approved',
           updated_at = CURRENT_TIMESTAMP
       WHERE email = 'lachureshmi6@gmail.com'`,
    )
    .run();
}

function applyRule(
  item: MenuItem,
  quantity: number,
  rules: PricingRule[],
) {
  const lineSubtotal = item.base_price_cents * quantity;
  const candidates = rules.filter((rule) => {
    if (!rule.auto_apply && rule.is_bulk_order !== 1) {
      return false;
    }
    if (quantity < (rule.minimum_quantity ?? 0)) {
      return false;
    }
    if (rule.applies_to === "specific_item") {
      return rule.menu_item_id === item.id;
    }
    if (rule.applies_to === "category") {
      return rule.category_id === item.category_id;
    }
    return rule.applies_to === "all_items" || rule.applies_to === "all";
  });

  const rule = candidates[0];
  if (!rule) {
    return {
      lineSubtotal,
      lineDiscount: 0,
      lineTotal: lineSubtotal,
      ruleId: null as number | null,
      requiresApproval: false,
    };
  }

  let lineTotal = lineSubtotal;
  if (rule.pricing_method === "fixed_unit_price" && rule.fixed_unit_price_cents) {
    lineTotal = rule.fixed_unit_price_cents * quantity;
  } else if (
    rule.pricing_method === "fixed_total_price" &&
    rule.fixed_total_price_cents
  ) {
    lineTotal = rule.fixed_total_price_cents;
  } else if (rule.pricing_method === "percent_discount" && rule.discount_percent) {
    lineTotal = Math.round(lineSubtotal * (1 - rule.discount_percent / 100));
  } else if (
    rule.pricing_method === "amount_discount" &&
    rule.discount_amount_cents
  ) {
    lineTotal = Math.max(0, lineSubtotal - rule.discount_amount_cents * quantity);
  }

  return {
    lineSubtotal,
    lineDiscount: Math.max(0, lineSubtotal - lineTotal),
    lineTotal,
    ruleId: rule.id,
    requiresApproval: rule.requires_admin_approval === 1,
  };
}

export async function submitOrder(formData: FormData) {
  await ensureKitchenSchema();
  const db = await requireDb();
  const settingsRows = await db.prepare("SELECT key, value FROM app_settings").all<{
    key: string;
    value: string;
  }>();
  const settings = Object.fromEntries(
    (settingsRows.results ?? []).map((row) => [row.key, row.value]),
  );
  if (!settingBool(settings, "public_allow_guest_order", true)) {
    throw new Error("Guest orders are currently disabled.");
  }

  const orderType = requiredString(formData, "order_type") as OrderType;
  const fulfillmentMethod = requiredString(formData, "fulfillment_method");
  const selectedStartDate = requiredString(formData, "selected_start_date");
  const selectedEndDate = optionalString(formData, "selected_end_date") ?? selectedStartDate;
  const selectedDays = optionalString(formData, "selected_days");
  const customerName = requiredString(formData, "customer_name");
  const customerPhone = requiredString(formData, "customer_phone");
  const customerEmail = optionalString(formData, "customer_email");
  const customerNotes = optionalString(formData, "customer_notes");
  const allergyNotes = optionalString(formData, "allergy_notes");
  const submissionToken = optionalString(formData, "submission_token");

  validatePlanDates(orderType, selectedStartDate, selectedDays);
  await validateHolidayDates(db, selectedStartDate, selectedDays);

  if (submissionToken) {
    const existingSubmission = await db
      .prepare("SELECT id, order_number FROM orders WHERE submission_token = ? LIMIT 1")
      .bind(submissionToken)
      .first<{ id: number; order_number: string }>();
    if (existingSubmission) {
      redirect(
        `/order/confirmation?order=${existingSubmission.id}&number=${encodeURIComponent(
          existingSubmission.order_number,
        )}`,
      );
    }
  }

  const deliveryEnabled = settingBool(settings, "delivery_enabled", false);
  if (fulfillmentMethod === "delivery" && !deliveryEnabled) {
    throw new Error("Delivery is currently disabled.");
  }
  const deliveryAddress =
    fulfillmentMethod === "delivery" ? requiredString(formData, "delivery_address") : null;
  const deliveryCity =
    fulfillmentMethod === "delivery" ? requiredString(formData, "delivery_city") : null;
  const deliveryPostalCode =
    fulfillmentMethod === "delivery" ? requiredString(formData, "delivery_postal_code") : null;
  const deliveryInstructions = optionalString(formData, "delivery_instructions");

  const pickupSlotId =
    fulfillmentMethod === "pickup"
      ? Number(requiredString(formData, "pickup_slot_id"))
      : null;
  const slot = pickupSlotId
    ? await db
        .prepare("SELECT * FROM pickup_slots WHERE id = ? AND is_active = 1")
        .bind(pickupSlotId)
        .first<{ id: number; start_time: string; end_time: string }>()
    : null;
  if (fulfillmentMethod === "pickup" && !slot) {
    throw new Error("Please choose a valid pickup slot.");
  }

  const pickupTime = slot?.start_time ?? "delivery";
  const pickupDateTime = new Date(`${selectedStartDate}T${slot?.start_time ?? "12:00"}:00`);
  const cutoffHours = settingNumber(settings, "order_cutoff_hours_before_pickup", 24);
  const sameDay = settingBool(settings, "same_day_order_enabled", false);
  if (!sameDay) {
    const today = new Date().toISOString().slice(0, 10);
    if (selectedStartDate <= today) {
      redirect("/order?error=Same-day%20ordering%20is%20not%20available.");
    }
  }
  if (pickupDateTime.getTime() - Date.now() < cutoffHours * 60 * 60 * 1000) {
    redirect(
      `/order?error=${encodeURIComponent(
        `Orders must be placed at least ${cutoffHours} hours before pickup. Please choose a later pickup date.`,
      )}`,
    );
  }

  const items = await db
    .prepare(
      `SELECT mi.*, mc.name AS category_name
       FROM menu_items mi
       LEFT JOIN menu_categories mc ON mc.id = mi.category_id
       WHERE mi.is_active = 1 AND mi.is_public = 1`,
    )
    .all<MenuItem>();
  const availabilityResult = await db
    .prepare("SELECT * FROM menu_item_availability WHERE is_active = 1")
    .all<MenuAvailability>();
  const pricesResult = await db
    .prepare("SELECT * FROM menu_prices WHERE active = 1 ORDER BY effective_from DESC")
    .all<MenuPrice>();
  const thaliResult = await db
    .prepare("SELECT * FROM thali_plans WHERE active = 1")
    .all<ThaliPlan>();

  const availability = availabilityResult.results ?? [];
  const prices = pricesResult.results ?? [];
  const itemMap = new Map((items.results ?? []).map((item) => [item.id, item]));
  const selected = [...itemMap.values()]
    .map((item) => ({
      item,
      quantity: Math.max(0, Number(formData.get(`quantity_${item.id}`) ?? 0)),
    }))
    .filter((entry) => entry.quantity > 0);
  const selectedPlans = (thaliResult.results ?? [])
    .filter((plan) => plan.plan_type === orderType && isThaliPlanAvailableOn(plan, selectedStartDate))
    .map((plan) => ({
      plan,
      quantity: Math.max(0, Number(formData.get(`thali_quantity_${plan.id}`) ?? 0)),
    }))
    .filter((entry) => entry.quantity > 0);

  if (selected.length === 0 && selectedPlans.length === 0) {
    throw new Error("Please choose at least one menu item.");
  }
  if (selected.some((entry) => entry.item.public_sold_out === 1)) {
    throw new Error("One selected item is sold out. Please update your order.");
  }
  if (
    selected.some(
      ({ item }) =>
        !isMenuItemAvailableOn(item, availability, selectedStartDate) ||
        (orderType === "bulk" && item.bulk_order_eligible !== 1),
    )
  ) {
    throw new Error("One selected item is not available for this order date.");
  }
  if (orderType === "bulk") {
    for (const { item, quantity } of selected) {
      if (item.min_bulk_quantity && quantity < item.min_bulk_quantity) {
        throw new Error(`${item.name} has a minimum bulk quantity of ${item.min_bulk_quantity}.`);
      }
      if (item.max_bulk_quantity && quantity > item.max_bulk_quantity) {
        throw new Error(`${item.name} has a maximum bulk quantity of ${item.max_bulk_quantity}.`);
      }
      const requiredMs = item.bulk_notice_hours * 60 * 60 * 1000;
      if (new Date(`${selectedStartDate}T12:00:00`).getTime() - Date.now() < requiredMs) {
        throw new Error(
          `Bulk order for ${item.name} requires at least ${item.bulk_notice_hours} hours notice.`,
        );
      }
    }
  }

  const priced = selected.map(({ item, quantity }) => ({
    item,
    quantity,
    unitPrice: effectivePrice(
      prices,
      selectedStartDate,
      { menuItemId: item.id, priceType: orderType === "bulk" ? "bulk" : "regular" },
      item.base_price_cents,
    ),
  }));
  const pricedPlans = selectedPlans.map(({ plan, quantity }) => ({
    plan,
    quantity,
    unitPrice: effectivePrice(
      prices,
      selectedStartDate,
      { thaliPlanId: plan.id, priceType: "subscription" },
      0,
    ),
  }));

  const subtotal =
    priced.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) +
    pricedPlans.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const deliveryFee =
    fulfillmentMethod === "delivery"
      ? Math.round(settingNumber(settings, "delivery_fee", 0) * 100)
      : 0;
  const total = subtotal + deliveryFee;
  const manualApproval = settingBool(settings, "manual_order_approval_required", true);
  const requiresApproval = manualApproval || orderType === "bulk";
  const status = "pending";
  const customerFacingStatus = requiresApproval ? "Pending approval" : "Order received";
  const createdOrderNumber = orderNumber();

  const customerId = await upsertCustomerForOrder(
    db,
    customerName,
    customerEmail,
    customerPhone,
  );

  const orderResult = await db
    .prepare(
      `INSERT INTO orders (
         order_number, submission_token, customer_id, customer_name, customer_phone, customer_email,
         order_type, fulfillment_method, delivery_address, delivery_city,
         delivery_postal_code, delivery_instructions, allergy_notes, order_notes,
         selected_start_date, selected_end_date, selected_days,
         pickup_date, pickup_time, pickup_slot_id, pickup_datetime, status,
         customer_facing_status, subtotal_cents, discount_total_cents,
         tax_total_cents, total_cents, total_amount, payment_status, is_bulk_order,
         bulk_rule_id, requires_admin_approval, customer_notes
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?)`,
    )
    .bind(
      createdOrderNumber,
      submissionToken,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      orderType,
      fulfillmentMethod,
      deliveryAddress,
      deliveryCity,
      deliveryPostalCode,
      deliveryInstructions,
      allergyNotes,
      customerNotes,
      selectedStartDate,
      selectedEndDate,
      selectedDays,
      selectedStartDate,
      pickupTime,
      pickupSlotId,
      `${selectedStartDate}T${slot?.start_time ?? "12:00"}:00`,
      status,
      customerFacingStatus,
      subtotal,
      0,
      0,
      total,
      total / 100,
      orderType === "bulk" ? 1 : 0,
      null,
      requiresApproval ? 1 : 0,
      customerNotes,
    )
    .run();

  const orderId = orderResult.meta.last_row_id;
  if (!orderId) {
    throw new Error("Order could not be created.");
  }

  await db
    .prepare(
      `UPDATE orders
       SET customer_id = ?
       WHERE customer_id IS NULL
         AND (
           (customer_email IS NOT NULL AND lower(customer_email) = lower(?))
           OR customer_phone = ?
         )`,
    )
    .bind(customerId, customerEmail ?? "", customerPhone)
    .run();

  for (const line of priced) {
    const lineTotal = line.quantity * line.unitPrice;
    await db
      .prepare(
        `INSERT INTO order_items (
           order_id, menu_item_id, item_name_snapshot, item_description_snapshot,
           quantity, unit_price_cents, unit_price, line_subtotal_cents,
           line_discount_cents, line_total_cents, total_price, order_date
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        orderId,
        line.item.id,
        line.item.name,
        line.item.description,
        line.quantity,
        line.unitPrice,
        line.unitPrice / 100,
        lineTotal,
        0,
        lineTotal,
        lineTotal / 100,
        selectedStartDate,
      )
      .run();
  }
  for (const line of pricedPlans) {
    const lineTotal = line.quantity * line.unitPrice;
    await db
      .prepare(
        `INSERT INTO order_items (
           order_id, thali_plan_id, item_name_snapshot, item_description_snapshot,
           quantity, unit_price_cents, unit_price, line_subtotal_cents,
           line_discount_cents, line_total_cents, total_price, order_date
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      )
      .bind(
        orderId,
        line.plan.id,
        line.plan.name,
        line.plan.description,
        line.quantity,
        line.unitPrice,
        line.unitPrice / 100,
        lineTotal,
        lineTotal,
        lineTotal / 100,
        selectedStartDate,
      )
      .run();
  }

  try {
    await queueAdminNewOrderWhatsApp(db, settings, {
      id: orderId,
      orderNumber: createdOrderNumber,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      pickupDate: selectedStartDate,
      pickupTime,
      totalCents: total,
    });
  } catch {
    // Do not block customer checkout if the admin notification queue fails.
  }
  try {
    await queueCustomerOrderTrackingNotifications(db, settings, {
      id: orderId,
      orderNumber: createdOrderNumber,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      pickupDate: selectedStartDate,
      pickupTime,
      status: customerFacingStatus,
    });
  } catch {
    // Do not block checkout if the customer notification queue fails.
  }

  revalidatePath("/admin/orders");
  await refreshCustomerRollup(db, customerId);
  revalidatePath("/admin/customers");
  redirect(
    `/order/confirmation?order=${orderId}&number=${encodeURIComponent(createdOrderNumber)}`,
  );
}

export async function submitReview(formData: FormData) {
  const db = await requireDb();
  const settingsRows = await db.prepare("SELECT key, value FROM app_settings").all<{
    key: string;
    value: string;
  }>();
  const settings = Object.fromEntries(
    (settingsRows.results ?? []).map((row) => [row.key, row.value]),
  );
  if (!settingBool(settings, "public_allow_reviews", true)) {
    throw new Error("Review submission is currently disabled.");
  }
  const name = requiredString(formData, "customer_name");
  const rating = Math.min(5, Math.max(1, Number(requiredString(formData, "rating"))));
  const comment = requiredString(formData, "comment");
  await db
    .prepare(
      `INSERT INTO reviews (customer_name, rating, comment, moderation_status)
       VALUES (?, ?, ?, 'pending')`,
    )
    .bind(name, rating, comment)
    .run();
  revalidatePath("/reviews");
  redirect("/reviews?submitted=1");
}

export async function requestReviewToken(formData: FormData) {
  await ensureKitchenSchema();
  const db = await requireDb();
  const settingsRows = await db.prepare("SELECT key, value FROM app_settings").all<{
    key: string;
    value: string;
  }>();
  const settings = Object.fromEntries(
    (settingsRows.results ?? []).map((row) => [row.key, row.value]),
  );
  if (!settingBool(settings, "public_allow_reviews", true)) {
    throw new Error("Review submission is currently disabled.");
  }

  const orderNumberValue = requiredString(formData, "order_number");
  const contact = requiredString(formData, "email_or_phone");
  const orderData = await getOrderForLookup(orderNumberValue, contact);
  if (!orderData) {
    redirect(`/reviews?error=order-not-found&order=${encodeURIComponent(orderNumberValue)}`);
  }

  const existingReview = await db
    .prepare("SELECT id FROM reviews WHERE order_id = ? LIMIT 1")
    .bind(orderData.order.id)
    .first<{ id: number }>();
  if (existingReview) {
    redirect(`/reviews?error=already-reviewed&order=${encodeURIComponent(orderNumberValue)}`);
  }

  const token = reviewToken();
  const tokenHash = await sha256Hex(token);
  const destination = contact.trim();
  const isEmail = destination.includes("@");
  const channel = isEmail ? "email" : "whatsapp";
  const customerId = orderData.order.customer_id ?? null;
  const expiresAt = sqliteDateTime(new Date(Date.now() + 30 * 60 * 1000));

  await db
    .prepare(
      `INSERT INTO customer_verifications
       (customer_id, verification_type, destination, token_hash, expires_at, status)
       VALUES (?, 'review_token', ?, ?, ?, 'pending')`,
    )
    .bind(customerId, `${orderData.order.id}:${destination.toLowerCase()}`, tokenHash, expiresAt)
    .run();

  await db
    .prepare(
      `INSERT INTO notifications
       (notification_type, channel, recipient_type, recipient_value, customer_id, order_id, subject, message, status)
       VALUES ('review_token', ?, 'customer', ?, ?, ?, 'Annapoorna review code', ?, 'pending')`,
    )
    .bind(
      channel,
      destination,
      customerId,
      orderData.order.id,
      `Your Annapoorna review verification code is ${token}. It expires in 30 minutes.`,
    )
    .run();

  redirect(`/reviews?token=sent&order=${encodeURIComponent(orderNumberValue)}`);
}

export async function submitVerifiedReview(formData: FormData) {
  await ensureKitchenSchema();
  const db = await requireDb();
  const settingsRows = await db.prepare("SELECT key, value FROM app_settings").all<{
    key: string;
    value: string;
  }>();
  const settings = Object.fromEntries(
    (settingsRows.results ?? []).map((row) => [row.key, row.value]),
  );
  if (!settingBool(settings, "public_allow_reviews", true)) {
    throw new Error("Review submission is currently disabled.");
  }

  const orderNumberValue = requiredString(formData, "order_number");
  const contact = requiredString(formData, "email_or_phone");
  const token = requiredString(formData, "review_token");
  const orderData = await getOrderForLookup(orderNumberValue, contact);
  if (!orderData) {
    redirect(`/reviews?error=order-not-found&order=${encodeURIComponent(orderNumberValue)}`);
  }

  const existingReview = await db
    .prepare("SELECT id FROM reviews WHERE order_id = ? LIMIT 1")
    .bind(orderData.order.id)
    .first<{ id: number }>();
  if (existingReview) {
    redirect(`/reviews?error=already-reviewed&order=${encodeURIComponent(orderNumberValue)}`);
  }

  const destination = `${orderData.order.id}:${contact.trim().toLowerCase()}`;
  const tokenHash = await sha256Hex(token);
  const verification = await db
    .prepare(
      `SELECT id, attempts
       FROM customer_verifications
       WHERE verification_type = 'review_token'
         AND destination = ?
         AND token_hash = ?
         AND status = 'pending'
         AND expires_at > datetime('now')
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(destination, tokenHash)
    .first<{ id: number; attempts: number }>();
  if (!verification) {
    await db
      .prepare(
        `UPDATE customer_verifications
         SET attempts = attempts + 1
         WHERE verification_type = 'review_token' AND destination = ? AND status = 'pending'`,
      )
      .bind(destination)
      .run();
    redirect(`/reviews?error=invalid-token&order=${encodeURIComponent(orderNumberValue)}`);
  }

  const name = requiredString(formData, "customer_name");
  const rating = Math.min(5, Math.max(1, Number(requiredString(formData, "rating"))));
  const comment = requiredString(formData, "comment");
  await db
    .prepare(
      `INSERT INTO reviews
       (customer_id, order_id, reviewer_contact, customer_name, rating, comment,
        is_verified_customer, moderation_status)
       VALUES (?, ?, ?, ?, ?, ?, 1, 'pending')`,
    )
    .bind(
      orderData.order.customer_id,
      orderData.order.id,
      contact.trim(),
      name,
      rating,
      comment,
    )
    .run();
  await db
    .prepare(
      "UPDATE customer_verifications SET verified_at = CURRENT_TIMESTAMP, status = 'verified' WHERE id = ?",
    )
    .bind(verification.id)
    .run();
  revalidatePath("/reviews");
  revalidatePath("/admin/reviews");
  redirect("/reviews?submitted=1");
}

export async function moderateReview(formData: FormData) {
  const admin = await requireAdminSession();
  const db = await requireDb();
  const reviewId = Number(requiredString(formData, "review_id"));
  const status = requiredString(formData, "moderation_status");
  const reason = optionalString(formData, "rejected_reason");
  const current = await db
    .prepare("SELECT moderation_status FROM reviews WHERE id = ?")
    .bind(reviewId)
    .first<{ moderation_status: string }>();
  await db
    .prepare(
      `UPDATE reviews
       SET moderation_status = ?,
           approved_by_admin_id = CASE WHEN ? = 'approved' THEN ? ELSE approved_by_admin_id END,
           approved_at = CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
           rejected_reason = ?
       WHERE id = ?`,
    )
    .bind(status, status, admin.id, status, reason, reviewId)
    .run();
  await db
    .prepare(
      `INSERT INTO review_moderation_history
       (review_id, old_status, new_status, changed_by_admin_id, notes)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(reviewId, current?.moderation_status ?? null, status, admin.id, reason)
    .run();
  revalidatePath("/admin/reviews");
  revalidatePath("/reviews");
}

export async function registerCustomer(formData: FormData) {
  const db = await requireDb();
  const fullName = requiredString(formData, "full_name");
  const email = optionalString(formData, "email");
  const phone = requiredString(formData, "phone");
  await db
    .prepare(
      `INSERT INTO customers (full_name, email, phone, status, consent_timestamp)
       VALUES (?, ?, ?, 'pending_verification', CURRENT_TIMESTAMP)
       ON CONFLICT(phone) DO UPDATE SET
         full_name = excluded.full_name,
         email = excluded.email,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(fullName, email, phone)
    .run();
  redirect("/account/login?registered=1");
}

export async function loginCustomer(formData: FormData) {
  const identifier = requiredString(formData, "email_or_phone");
  const customer = await getCustomerByLogin(identifier);
  if (!customer) {
    redirect("/account/login?error=not-found");
  }
  await setCustomerSession(customer);
  redirect("/my-orders");
}

export async function logoutCustomer() {
  await clearCustomerSession();
  redirect("/account/login");
}

export async function lookupOrder(formData: FormData) {
  const orderNumberValue = requiredString(formData, "order_number");
  const lookup = requiredString(formData, "email_or_phone");
  const result = await getOrderForLookup(orderNumberValue, lookup);
  if (!result) {
    redirect(
      `/track-order?error=not-found&order=${encodeURIComponent(orderNumberValue)}`,
    );
  }
  redirect(`/track-order?order=${encodeURIComponent(orderNumberValue)}&found=1`);
}

export async function loginAdmin(formData: FormData) {
  const db = await requireDb();
  const email = requiredString(formData, "email").toLowerCase();
  const password = requiredString(formData, "passcode");
  const env = await getRuntimeEnv();
  await ensureAdminPasswordColumns();
  const admin = await db
    .prepare(
      "SELECT id, email, password_hash, password_salt FROM admin_users WHERE lower(email) = lower(?) AND status = 'approved'",
    )
    .bind(email)
    .first<{
      id: number;
      email: string;
      password_hash: string | null;
      password_salt: string | null;
    }>();
  if (!admin) {
    redirect("/admin?error=invalid");
  }
  if (admin.password_hash && admin.password_salt) {
    const submittedHash = await hashAdminPassword(password, admin.password_salt);
    if (submittedHash !== admin.password_hash) {
      redirect("/admin?error=invalid");
    }
  } else {
    const expectedPasscode = env.ANNAPOORNA_ADMIN_PASSCODE;
    if (!expectedPasscode) {
      redirect("/admin?error=missing-passcode");
    }
    if (password !== expectedPasscode) {
      redirect("/admin?error=invalid");
    }
  }
  await db
    .prepare("UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(admin.id)
    .run();
  await setAdminSession(admin);
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin");
}

export async function updateOrderStatus(formData: FormData) {
  const admin = await requireAdminSession();
  const orderId = Number(requiredString(formData, "order_id"));
  const status = requiredString(formData, "status");
  const facingStatus = customerFacingOrderStatus(status);
  const db = await requireDb();
  const current = await db
    .prepare("SELECT status FROM orders WHERE id = ?")
    .bind(orderId)
    .first<{ status: string }>();
  await db
    .prepare(
      `UPDATE orders
       SET status = ?, customer_facing_status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(status, facingStatus, orderId)
    .run();
  try {
    await db
      .prepare(
        `INSERT INTO order_status_history
         (order_id, old_status, new_status, changed_by_type, changed_by_id, note)
         VALUES (?, ?, ?, 'admin', ?, 'Updated from admin orders page')`,
      )
      .bind(orderId, current?.status ?? null, status, admin.id)
      .run();
  } catch {
    // Status update should not fail if an older database is missing history support.
  }
  revalidatePath("/admin/orders");
  revalidatePath("/track-order");
  adminOrdersRedirect(formData, "status");
}

export async function updateOrderPayment(formData: FormData) {
  await requireAdminSession();
  const orderId = Number(requiredString(formData, "order_id"));
  const paymentStatus = requiredString(formData, "payment_status");
  const paymentMethod = optionalString(formData, "payment_method") ?? "manual";
  const receivedAmountCents = Math.max(
    0,
    Math.round(Number(formData.get("received_amount") ?? 0) * 100),
  );
  const db = await requireDb();
  const order = await db
    .prepare(
      `SELECT customer_id, subtotal_cents, discount_total_cents, tax_total_cents, total_cents
       FROM orders
       WHERE id = ?`,
    )
    .bind(orderId)
    .first<{
      customer_id: number | null;
      subtotal_cents: number;
      discount_total_cents: number;
      tax_total_cents: number;
      total_cents: number;
    }>();
  if (!order) {
    throw new Error("Order not found.");
  }
  const recordsPayment =
    paymentStatus === "paid" ||
    paymentStatus === "verified" ||
    paymentStatus === "refunded";
  const expectedBeforeAdjustment = Math.max(
    order.total_cents + (order.discount_total_cents ?? 0),
    (order.subtotal_cents ?? 0) + (order.tax_total_cents ?? 0),
  );
  const reconciledDiscount =
    recordsPayment && receivedAmountCents < expectedBeforeAdjustment
      ? expectedBeforeAdjustment - receivedAmountCents
      : 0;
  const excessReceived =
    recordsPayment && receivedAmountCents > expectedBeforeAdjustment
      ? receivedAmountCents - expectedBeforeAdjustment
      : 0;
  const reconciledOrderTotal =
    recordsPayment && receivedAmountCents < expectedBeforeAdjustment
      ? receivedAmountCents
      : expectedBeforeAdjustment || order.total_cents || 0;
  const reconciliationNote =
    excessReceived > 0
      ? `Excess received: ${(excessReceived / 100).toFixed(2)}`
      : reconciledDiscount > 0
        ? `Short payment moved to discount: ${(reconciledDiscount / 100).toFixed(2)}`
        : null;
  await db
    .prepare(
      `UPDATE orders
       SET payment_status = ?,
           discount_total_cents = ?,
           total_cents = ?,
           total_amount = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(
      paymentStatus,
      recordsPayment ? reconciledDiscount : (order.discount_total_cents ?? 0),
      recordsPayment ? reconciledOrderTotal : (order.total_cents ?? 0),
      (recordsPayment ? reconciledOrderTotal : (order.total_cents ?? 0)) / 100,
      orderId,
    )
    .run();
  if (order?.customer_id) {
    const existingPayment = await db
      .prepare("SELECT id FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1")
      .bind(orderId)
      .first<{ id: number }>();
    if (existingPayment) {
      const effectiveMethod =
        paymentMethod === "none" ? "manual" : paymentMethod;
      await db
        .prepare(
          `UPDATE payments
           SET payment_status = ?,
               payment_method = ?,
               expected_amount_cents = ?,
               received_amount_cents = ?,
               notes = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(
          paymentStatus,
          effectiveMethod,
          expectedBeforeAdjustment,
          recordsPayment ? receivedAmountCents : 0,
          reconciliationNote,
          existingPayment.id,
        )
        .run();
    } else if (recordsPayment) {
      const effectiveMethod =
        paymentMethod === "none" ? "manual" : paymentMethod;
      await db
        .prepare(
          `INSERT INTO payments
           (order_id, customer_id, payment_method, payment_status, expected_amount_cents,
            received_amount_cents, payment_reference, notes)
           VALUES (?, ?, ?, ?, ?, ?, 'order-status', ?)`,
        )
        .bind(
          orderId,
          order.customer_id,
          effectiveMethod,
          paymentStatus,
          expectedBeforeAdjustment,
          receivedAmountCents,
          reconciliationNote ?? "Created from order payment status",
        )
        .run();
    }
    await refreshCustomerRollup(db, order.customer_id);
  }
  revalidatePath("/admin/orders");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/customers");
  adminOrdersRedirect(formData, "payment");
}

export async function deleteOrder(formData: FormData) {
  await requireAdminSession();
  const orderId = Number(requiredString(formData, "order_id"));
  const db = await requireDb();
  const order = await db
    .prepare("SELECT id, order_number, customer_id FROM orders WHERE id = ?")
    .bind(orderId)
    .first<{ id: number; order_number: string; customer_id: number | null }>();
  if (!order) {
    throw new Error("Order not found.");
  }

  await runOptionalMutation(
    db,
    `DELETE FROM message_attachments
     WHERE message_id IN (
       SELECT cm.id
       FROM conversation_messages cm
       INNER JOIN conversations c ON c.id = cm.conversation_id
       WHERE c.order_id = ?
     )`,
    [orderId],
  );
  await runOptionalMutation(
    db,
    `DELETE FROM notifications
     WHERE order_id = ?
        OR conversation_message_id IN (
          SELECT cm.id
          FROM conversation_messages cm
          INNER JOIN conversations c ON c.id = cm.conversation_id
          WHERE c.order_id = ?
        )`,
    [orderId, orderId],
  );
  await runOptionalMutation(
    db,
    `DELETE FROM conversation_messages
     WHERE conversation_id IN (SELECT id FROM conversations WHERE order_id = ?)`,
    [orderId],
  );
  await runOptionalMutation(db, "DELETE FROM conversations WHERE order_id = ?", [orderId]);
  await runOptionalMutation(
    db,
    "DELETE FROM review_moderation_history WHERE review_id IN (SELECT id FROM reviews WHERE order_id = ?)",
    [orderId],
  );
  await runOptionalMutation(db, "DELETE FROM reviews WHERE order_id = ?", [orderId]);
  await runOptionalMutation(
    db,
    "DELETE FROM order_item_preferences WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)",
    [orderId],
  );
  await runOptionalMutation(db, "DELETE FROM order_status_history WHERE order_id = ?", [orderId]);
  await runOptionalMutation(db, "DELETE FROM order_pricing_adjustments WHERE order_id = ?", [orderId]);
  await runOptionalMutation(
    db,
    "DELETE FROM payment_audit_history WHERE payment_id IN (SELECT id FROM payments WHERE order_id = ?)",
    [orderId],
  );
  await runOptionalMutation(
    db,
    "DELETE FROM payment_matches WHERE order_id = ? OR payment_id IN (SELECT id FROM payments WHERE order_id = ?)",
    [orderId, orderId],
  );
  await runOptionalMutation(db, "DELETE FROM payments WHERE order_id = ?", [orderId]);
  await db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(orderId).run();
  await db.prepare("DELETE FROM orders WHERE id = ?").bind(orderId).run();

  if (order.customer_id) {
    await refreshCustomerRollup(db, order.customer_id);
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/reviews");
  revalidatePath("/reviews");
  revalidatePath("/track-order");
  adminOrdersRedirect(formData, "deleted");
}

async function syncMenuAvailability(menuItemId: number, formData: FormData) {
  const db = await requireDb();
  const days = formData.getAll("availability_days").map((value) => Number(value));
  const startDate = optionalString(formData, "menu_start_date");
  const endDate = optionalString(formData, "menu_end_date");
  await db
    .prepare("DELETE FROM menu_item_availability WHERE menu_item_id = ?")
    .bind(menuItemId)
    .run();
  for (const day of days) {
    await db
      .prepare(
        `INSERT INTO menu_item_availability
         (menu_item_id, availability_type, day_of_week, start_date, end_date, is_active)
         VALUES (?, 'weekly', ?, ?, ?, 1)`,
      )
      .bind(menuItemId, day, startDate, endDate)
      .run();
    await db
      .prepare(
        `INSERT INTO menu_availability
         (menu_item_id, day_of_week, start_date, end_date, active)
         VALUES (?, ?, ?, ?, 1)`,
      )
      .bind(menuItemId, day, startDate, endDate)
      .run();
  }
}

async function addMenuPriceFromForm(
  menuItemId: number,
  formData: FormData,
  fieldName: string,
  priceType: "regular" | "bulk",
) {
  const value = Number(formData.get(fieldName) ?? 0);
  const effectiveFrom = optionalString(formData, `${fieldName}_effective_from`);
  if (!value || !effectiveFrom) {
    return;
  }
  const db = await requireDb();
  const priceCents = Math.round(value * 100);
  const current = await db
    .prepare(
      `SELECT id, price_cents, effective_from
       FROM menu_prices
       WHERE menu_item_id = ? AND price_type = ? AND active = 1 AND effective_to IS NULL
       ORDER BY effective_from DESC, id DESC
       LIMIT 1`,
    )
    .bind(menuItemId, priceType)
    .first<{ id: number; price_cents: number; effective_from: string }>();
  if (current?.effective_from === effectiveFrom) {
    await db
      .prepare(
        `UPDATE menu_prices
         SET price_cents = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(priceCents, current.id)
      .run();
    return;
  }
  if (current?.price_cents === priceCents) {
    return;
  }
  await db
    .prepare(
      `UPDATE menu_prices
       SET effective_to = date(?, '-1 day'), updated_at = CURRENT_TIMESTAMP
       WHERE menu_item_id = ? AND price_type = ? AND active = 1 AND effective_to IS NULL`,
    )
    .bind(effectiveFrom, menuItemId, priceType)
    .run();
  await db
    .prepare(
      `INSERT INTO menu_prices
       (menu_item_id, price_type, price_cents, effective_from, active)
       VALUES (?, ?, ?, ?, 1)`,
    )
    .bind(menuItemId, priceType, priceCents, effectiveFrom)
    .run();
}

async function syncIngredientLines(menuItemId: number, formData: FormData) {
  const lines = String(formData.get("ingredient_lines") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return;
  }
  const db = await requireDb();
  await db
    .prepare("DELETE FROM menu_item_ingredients WHERE menu_item_id = ?")
    .bind(menuItemId)
    .run();
  for (const line of lines) {
    const [name, quantity, unit, ...basisParts] = line.split("|").map((part) => part.trim());
    if (!name || !quantity || !unit) {
      continue;
    }
    await db
      .prepare("INSERT OR IGNORE INTO ingredients (name, unit, active) VALUES (?, ?, 1)")
      .bind(name, unit)
      .run();
    const ingredient = await db
      .prepare("SELECT id FROM ingredients WHERE name = ?")
      .bind(name)
      .first<{ id: number }>();
    if (!ingredient) {
      continue;
    }
    await db
      .prepare(
        `INSERT INTO menu_item_ingredients
         (menu_item_id, ingredient_id, quantity_required, unit, quantity_basis)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(menuItemId, ingredient.id, Number(quantity), unit, basisParts.join("|") || "per plate")
      .run();
  }
}

export async function updateMenuItem(formData: FormData) {
  await requireAdminSession();
  const itemId = Number(requiredString(formData, "item_id"));
  const categoryId = Number(requiredString(formData, "category_id"));
  const name = requiredString(formData, "name");
  const description = sanitizeRichText(optionalString(formData, "description"));
  const imageUrl = normalizeStoredImageUrl(optionalString(formData, "image_url"));
  const foodType = requiredString(formData, "food_type");
  const priceCents = Math.max(0, Math.round(Number(formData.get("regular_price") || formData.get("price") || 0) * 100));
  const isPublic = formData.get("is_public") === "on" ? 1 : 0;
  const isActive = formData.get("is_active") === "on" ? 1 : 0;
  const soldOut = formData.get("public_sold_out") === "on" ? 1 : 0;
  const bulkEligible = formData.get("bulk_order_eligible") === "on" ? 1 : 0;
  const db = await requireDb();
  await db
    .prepare(
      `UPDATE menu_items
       SET category_id = ?, name = ?, description = ?, image_url = ?,
           base_price_cents = ?, serving_unit = ?, serving_definition = ?,
           bulk_order_eligible = ?, min_bulk_quantity = ?, max_bulk_quantity = ?,
           bulk_notice_hours = ?, menu_start_date = ?, menu_end_date = ?,
           is_public = ?, is_active = ?, public_sold_out = ?,
           food_type = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(
      categoryId,
      name,
      description,
      imageUrl,
      priceCents,
      requiredString(formData, "serving_unit"),
      optionalString(formData, "serving_definition"),
      bulkEligible,
      Number(formData.get("min_bulk_quantity") || 0) || null,
      Number(formData.get("max_bulk_quantity") || 0) || null,
      Number(formData.get("bulk_notice_hours") || 24),
      optionalString(formData, "menu_start_date"),
      optionalString(formData, "menu_end_date"),
      isPublic,
      isActive,
      soldOut,
      foodType,
      itemId,
    )
    .run();
  await syncMenuAvailability(itemId, formData);
  await addMenuPriceFromForm(itemId, formData, "regular_price", "regular");
  await addMenuPriceFromForm(itemId, formData, "bulk_price", "bulk");
  await syncIngredientLines(itemId, formData);
  revalidatePath("/admin/menu");
  revalidatePath("/order");
  redirect(`/admin/menu?saved=updated&item=${itemId}`);
}

export async function addMenuItem(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const categoryId = Number(requiredString(formData, "category_id"));
  const name = requiredString(formData, "name");
  const description = sanitizeRichText(optionalString(formData, "description"));
  const imageUrl = normalizeStoredImageUrl(optionalString(formData, "image_url"));
  const foodType = requiredString(formData, "food_type");
  const priceCents = Math.max(0, Math.round(Number(formData.get("regular_price") || formData.get("price") || 0) * 100));
  const bulkEligible = formData.get("bulk_order_eligible") === "on" ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO menu_items
       (category_id, name, description, image_url, base_price_cents,
        serving_unit, serving_definition, bulk_order_eligible, min_bulk_quantity,
        max_bulk_quantity, bulk_notice_hours, menu_start_date, menu_end_date,
        is_active, is_public, food_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
    )
    .bind(
      categoryId,
      name,
      description,
      imageUrl,
      priceCents,
      requiredString(formData, "serving_unit"),
      optionalString(formData, "serving_definition"),
      bulkEligible,
      Number(formData.get("min_bulk_quantity") || 0) || null,
      Number(formData.get("max_bulk_quantity") || 0) || null,
      Number(formData.get("bulk_notice_hours") || 24),
      optionalString(formData, "menu_start_date"),
      optionalString(formData, "menu_end_date"),
      foodType,
    )
    .run();
  const created = await db
    .prepare("SELECT id FROM menu_items WHERE name = ? ORDER BY id DESC LIMIT 1")
    .bind(name)
    .first<{ id: number }>();
  if (created) {
    await syncMenuAvailability(created.id, formData);
    await addMenuPriceFromForm(created.id, formData, "regular_price", "regular");
    await addMenuPriceFromForm(created.id, formData, "bulk_price", "bulk");
    await syncIngredientLines(created.id, formData);
  }
  revalidatePath("/admin/menu");
  revalidatePath("/order");
  redirect(`/admin/menu?saved=added`);
}

export async function addMenuCategory(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const name = requiredString(formData, "name");
  const description = optionalString(formData, "description");
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  const isActive = formData.get("is_active") === "on" ? 1 : 0;
  await db
    .prepare(
      `INSERT INTO menu_categories (name, description, sort_order, is_active)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         description = excluded.description,
         sort_order = excluded.sort_order,
         is_active = excluded.is_active`,
    )
    .bind(name, description, Number.isFinite(sortOrder) ? sortOrder : 0, isActive)
    .run();
  revalidatePath("/admin/menu");
  revalidatePath("/order");
  redirect("/admin/menu?saved=category");
}

export async function updateMenuCategory(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const categoryId = Number(requiredString(formData, "category_id"));
  const name = requiredString(formData, "name");
  const description = optionalString(formData, "description");
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  const isActive = formData.get("is_active") === "on" ? 1 : 0;
  await db
    .prepare(
      `UPDATE menu_categories
       SET name = ?,
           description = ?,
           sort_order = ?,
           is_active = ?
       WHERE id = ?`,
    )
    .bind(
      name,
      description,
      Number.isFinite(sortOrder) ? sortOrder : 0,
      isActive,
      categoryId,
    )
    .run();
  revalidatePath("/admin/menu");
  revalidatePath("/order");
  redirect("/admin/menu?saved=category");
}

export async function updateSetting(formData: FormData) {
  await requireAdminSession();
  const key = requiredString(formData, "key");
  const value = requiredString(formData, "value");
  const db = await requireDb();
  await db
    .prepare("UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?")
    .bind(value, key)
    .run();
  revalidatePath("/admin/settings");
  revalidatePath("/order");
}

export async function updateDeliverySettings(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const settings = [
    ["delivery_enabled", formData.get("delivery_enabled") === "on" ? "true" : "false"],
    ["delivery_fee", String(Number(formData.get("delivery_fee") ?? 0))],
    [
      "delivery_min_order_amount",
      String(Number(formData.get("delivery_min_order_amount") ?? 0)),
    ],
    ["delivery_service_area_note", String(formData.get("delivery_service_area_note") ?? "")],
  ];
  for (const [key, value] of settings) {
    await db
      .prepare(
        `INSERT INTO app_settings (key, value, value_type, category, description, is_public)
         VALUES (?, ?, ?, 'fulfillment', ?, 1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        key,
        value,
        key === "delivery_enabled" ? "boolean" : key.includes("amount") || key === "delivery_fee" ? "number" : "string",
        key,
      )
      .run();
  }
  revalidatePath("/admin/settings");
  revalidatePath("/order");
}

export async function updateHomeContent(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const settings = [
    ["home_menu_lines", String(formData.get("home_menu_lines") ?? "")],
    ["home_pickup_lines", String(formData.get("home_pickup_lines") ?? "")],
    ["home_perfect_for_lines", String(formData.get("home_perfect_for_lines") ?? "")],
  ];
  for (const [key, value] of settings) {
    await db
      .prepare(
        `INSERT INTO app_settings (key, value, value_type, category, description, is_public)
         VALUES (?, ?, 'text', 'home', ?, 1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(key, value, key)
      .run();
  }
  revalidatePath("/");
  revalidatePath("/admin/settings");
}

export async function updateReviewSettings(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const settings = [
    ["public_allow_reviews", formData.get("public_allow_reviews") === "on" ? "true" : "false", "boolean"],
    ["google_review_url", String(formData.get("google_review_url") ?? ""), "string"],
  ];
  for (const [key, value, type] of settings) {
    await db
      .prepare(
        `INSERT INTO app_settings (key, value, value_type, category, description, is_public)
         VALUES (?, ?, ?, 'reviews', ?, 1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(key, value, type, key)
      .run();
  }
  revalidatePath("/admin/settings");
  revalidatePath("/reviews");
}

export async function updateAdminAlertSettings(formData: FormData) {
  await requireAdminSession();
  await ensureKitchenSchema();
  const db = await requireDb();
  const adminIds = formData
    .getAll("admin_id")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  for (const adminId of adminIds) {
    const whatsappNumber = String(formData.get(`whatsapp_number_${adminId}`) ?? "")
      .trim()
      .replace(/\s+/g, "");
    const emailEnabled = formData.get(`email_alert_enabled_${adminId}`) === "on" ? 1 : 0;
    const whatsappEnabled = formData.get(`whatsapp_alert_enabled_${adminId}`) === "on" ? 1 : 0;
    await db
      .prepare(
        `UPDATE admin_users
         SET whatsapp_number = ?,
             email_alert_enabled = ?,
             whatsapp_alert_enabled = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(whatsappNumber || null, emailEnabled, whatsappEnabled, adminId)
      .run();
  }

  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=alerts");
}

export async function updateOrderNotificationSettings(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const settings = [
    [
      "order_customer_message_template",
      String(formData.get("order_customer_message_template") ?? ""),
      "text",
      "Message sent to customers after an order is placed.",
    ],
    [
      "order_admin_message_template",
      String(formData.get("order_admin_message_template") ?? ""),
      "text",
      "Message sent to admins after an order is placed.",
    ],
    [
      "portal_admin_signature",
      String(formData.get("portal_admin_signature") ?? ""),
      "text",
      "Reusable signature for portal notifications.",
    ],
  ];

  for (const [key, value, type, description] of settings) {
    await db
      .prepare(
        `INSERT INTO app_settings (key, value, value_type, category, description, is_public)
         VALUES (?, ?, ?, 'notifications', ?, 0)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(key, value, type, description)
      .run();
  }

  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=order-messages");
}

export async function createHoliday(formData: FormData) {
  await requireAdminSession();
  await ensureKitchenSchema();
  const db = await requireDb();
  const name = requiredString(formData, "name");
  const holidayDate = requiredString(formData, "holiday_date");
  const endDate = optionalString(formData, "end_date") ?? holidayDate;
  if (endDate < holidayDate) {
    throw new Error("Holiday end date cannot be before the start date.");
  }
  const noticeMessage = optionalString(formData, "notice_message");
  const isActive = formData.get("is_active") === "on" ? 1 : 0;
  const result = await db
    .prepare(
      `INSERT INTO holidays (name, holiday_date, end_date, notice_message, is_active)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(name, holidayDate, endDate, noticeMessage, isActive)
    .run();

  if (formData.get("send_notice") === "on" && isActive === 1) {
    try {
      await queueHolidayNotices(db, { name, holidayDate, endDate, noticeMessage });
    } catch {
      // Holiday creation should not fail if the notification queue has an issue.
    }
  }

  revalidatePath("/admin/holidays");
  revalidatePath("/order");
  redirect(`/admin/holidays?saved=created&holiday=${result.meta.last_row_id ?? ""}`);
}

export async function updateHoliday(formData: FormData) {
  await requireAdminSession();
  await ensureKitchenSchema();
  const db = await requireDb();
  const holidayId = Number(requiredString(formData, "holiday_id"));
  const name = requiredString(formData, "name");
  const holidayDate = requiredString(formData, "holiday_date");
  const endDate = optionalString(formData, "end_date") ?? holidayDate;
  if (endDate < holidayDate) {
    throw new Error("Holiday end date cannot be before the start date.");
  }
  const noticeMessage = optionalString(formData, "notice_message");
  const isActive = formData.get("is_active") === "on" ? 1 : 0;
  await db
    .prepare(
      `UPDATE holidays
       SET name = ?,
           holiday_date = ?,
           end_date = ?,
           notice_message = ?,
           is_active = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(name, holidayDate, endDate, noticeMessage, isActive, holidayId)
    .run();

  if (formData.get("send_notice") === "on" && isActive === 1) {
    try {
      await queueHolidayNotices(db, { name, holidayDate, endDate, noticeMessage });
    } catch {
      // Holiday updates should not fail if notification queueing has an issue.
    }
  }

  revalidatePath("/admin/holidays");
  revalidatePath("/order");
  redirect(`/admin/holidays?saved=updated&holiday=${holidayId}`);
}

export async function refundHolidayOrder(formData: FormData) {
  await requireAdminSession();
  await ensureKitchenSchema();
  const db = await requireDb();
  const holidayId = Number(requiredString(formData, "holiday_id"));
  const orderId = Number(requiredString(formData, "order_id"));
  const refundCents = Math.max(
    0,
    Math.round(Number(formData.get("refund_amount") ?? 0) * 100),
  );
  const order = await db
    .prepare(
      `SELECT id, order_number, customer_id, customer_name, customer_email, customer_phone,
              total_cents, payment_status
       FROM orders
       WHERE id = ?`,
    )
    .bind(orderId)
    .first<{
      id: number;
      order_number: string;
      customer_id: number | null;
      customer_name: string;
      customer_email: string | null;
      customer_phone: string;
      total_cents: number;
      payment_status: string;
    }>();
  if (!order) {
    throw new Error("Order not found.");
  }
  const holiday = await db
    .prepare("SELECT name, holiday_date, end_date FROM holidays WHERE id = ?")
    .bind(holidayId)
    .first<{ name: string; holiday_date: string; end_date: string | null }>();
  if (!holiday) {
    throw new Error("Holiday not found.");
  }

  const nextStatus = refundCents >= order.total_cents ? "refunded" : "partially_refunded";
  await db
    .prepare(
      `UPDATE orders
       SET payment_status = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(nextStatus, order.id)
    .run();

  if (order.customer_id) {
    await db
      .prepare(
        `INSERT INTO payments
         (order_id, customer_id, payment_method, payment_status, expected_amount_cents,
          received_amount_cents, payment_reference, notes)
         VALUES (?, ?, 'holiday_refund', 'refunded', ?, ?, ?, ?)`,
      )
      .bind(
        order.id,
        order.customer_id,
        order.total_cents,
        refundCents,
        `holiday-${holidayId}`,
        `Refund for ${holiday.name}`,
      )
      .run();
    await refreshCustomerRollup(db, order.customer_id);
  }

  const dateText =
    holiday.holiday_date === (holiday.end_date ?? holiday.holiday_date)
      ? holiday.holiday_date
      : `${holiday.holiday_date} to ${holiday.end_date}`;
  const message = [
    `Hi ${order.customer_name},`,
    "",
    `A refund of ${(refundCents / 100).toFixed(2)} has been recorded for order ${order.order_number} because Annapoorna is closed for ${holiday.name} on ${dateText}.`,
    "",
    "Regards,",
    "Team Annapoorna",
  ].join("\n");
  const recipients: Array<{ channel: "email" | "whatsapp"; value: string }> = [];
  if (order.customer_email) {
    recipients.push({ channel: "email", value: order.customer_email });
  }
  if (order.customer_phone) {
    recipients.push({ channel: "whatsapp", value: normalizePhone(order.customer_phone) });
  }
  for (const recipient of recipients) {
    await db
      .prepare(
        `INSERT INTO notifications
         (notification_type, channel, recipient_type, recipient_value, customer_id, order_id, subject, message, status)
         VALUES ('holiday_refund', ?, 'customer', ?, ?, ?, ?, ?, 'pending')`,
      )
      .bind(
        recipient.channel,
        recipient.value,
        order.customer_id,
        order.id,
        `Refund recorded for ${order.order_number}`,
        message,
      )
      .run();
  }

  revalidatePath("/admin/holidays");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/customers");
  redirect(`/admin/holidays?saved=refund&holiday=${holidayId}`);
}

export async function addInventoryItem(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  await db
    .prepare(
      `INSERT INTO inventory_items
       (name, inventory_type, category, unit, current_quantity, reorder_level, cost_per_unit_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      requiredString(formData, "name"),
      requiredString(formData, "inventory_type"),
      requiredString(formData, "category"),
      requiredString(formData, "unit"),
      Number(formData.get("current_quantity") ?? 0),
      Number(formData.get("reorder_level") ?? 0),
      Math.round(Number(formData.get("cost_per_unit") ?? 0) * 100),
    )
    .run();
  revalidatePath("/admin/inventory");
}

export async function addExpense(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  await db
    .prepare(
      `INSERT INTO expenses
       (expense_date, category_id, vendor, description, amount_cents, payment_method, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      requiredString(formData, "expense_date"),
      Number(formData.get("category_id") || 0) || null,
      optionalString(formData, "vendor"),
      requiredString(formData, "description"),
      Math.round(Number(formData.get("amount") ?? 0) * 100),
      optionalString(formData, "payment_method"),
      optionalString(formData, "notes"),
    )
    .run();
  revalidatePath("/admin/expenses");
}

export async function addPricingRule(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const pricingMethod = requiredString(formData, "pricing_method");
  const fixedUnit =
    pricingMethod === "fixed_unit_price"
      ? Math.round(Number(formData.get("fixed_unit_price") ?? 0) * 100)
      : null;
  const discountPercent =
    pricingMethod === "percent_discount"
      ? Number(formData.get("discount_percent") ?? 0)
      : null;
  await db
    .prepare(
      `INSERT INTO pricing_rules
       (name, description, rule_type, pricing_method, applies_to, menu_item_id,
        category_id, minimum_quantity, discount_percent, fixed_unit_price_cents,
        start_date, end_date, is_bulk_order, requires_admin_approval, is_public, auto_apply, is_active)
       VALUES (?, ?, 'bulk', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, 1, 1)`,
    )
    .bind(
      requiredString(formData, "name"),
      optionalString(formData, "description"),
      pricingMethod,
      requiredString(formData, "applies_to"),
      Number(formData.get("menu_item_id") || 0) || null,
      Number(formData.get("category_id") || 0) || null,
      Number(formData.get("minimum_quantity") ?? 2),
      discountPercent,
      fixedUnit,
      optionalString(formData, "start_date"),
      optionalString(formData, "end_date"),
      formData.get("requires_admin_approval") === "on" ? 1 : 0,
    )
    .run();
  revalidatePath("/admin/pricing");
  revalidatePath("/order");
}

export async function addThaliPlan(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const price = Number(formData.get("price") ?? 0);
  const effectiveFrom = requiredString(formData, "effective_from");
  const days = formData.getAll("available_days").join(",");
  const result = await db
    .prepare(
      `INSERT INTO thali_plans
       (name, description, plan_type, active, available_days, start_date, end_date)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
    )
    .bind(
      requiredString(formData, "name"),
      optionalString(formData, "description"),
      requiredString(formData, "plan_type"),
      days,
      optionalString(formData, "start_date"),
      optionalString(formData, "end_date"),
    )
    .run();
  const thaliPlanId = result.meta.last_row_id;
  if (thaliPlanId) {
    await db
      .prepare(
        `INSERT INTO menu_prices
         (thali_plan_id, price_type, price_cents, effective_from, active)
         VALUES (?, 'subscription', ?, ?, 1)`,
      )
      .bind(thaliPlanId, Math.round(price * 100), effectiveFrom)
      .run();
  }
  revalidatePath("/admin/pricing");
  revalidatePath("/order");
}

export async function recordPayment(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const orderIdValue = optionalString(formData, "order_id");
  const orderId = orderIdValue ? Number(orderIdValue) : null;
  const status = requiredString(formData, "payment_status");
  const amountCents = Math.round(Number(formData.get("received_amount") ?? 0) * 100);
  const paymentDate = optionalString(formData, "payment_date") ?? new Date().toISOString().slice(0, 10);
  const paymentCreatedAt = `${paymentDate} 12:00:00`;
  const order = orderId
    ? await db
        .prepare(
          `SELECT customer_id, customer_name, customer_email, customer_phone, total_cents
           FROM orders
           WHERE id = ?`,
        )
        .bind(orderId)
        .first<{
          customer_id: number | null;
          customer_name: string;
          customer_email: string | null;
          customer_phone: string;
          total_cents: number;
        }>()
    : null;
  const customerName = order?.customer_name ?? requiredString(formData, "customer_name");
  const customerEmail = order?.customer_email ?? optionalString(formData, "customer_email");
  const customerPhone = order?.customer_phone ?? requiredString(formData, "customer_phone");
  const customerId = order?.customer_id ?? (await upsertCustomerForOrder(db, customerName, customerEmail, customerPhone));
  if (orderId && !order?.customer_id) {
    await db
      .prepare("UPDATE orders SET customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(customerId, orderId)
      .run();
  }
  await db
    .prepare(
      `INSERT INTO payments
       (order_id, customer_id, payment_method, payment_status, expected_amount_cents,
        received_amount_cents, payment_reference, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      orderId,
      customerId,
      requiredString(formData, "payment_method"),
      status,
      order?.total_cents ?? amountCents,
      amountCents,
      optionalString(formData, "payment_reference"),
      optionalString(formData, "notes"),
      paymentCreatedAt,
      paymentCreatedAt,
    )
    .run();
  if (orderId) {
    await db
      .prepare("UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(status, orderId)
      .run();
  }
  await refreshCustomerRollup(db, customerId);
  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/customers");
}

export async function requestPickupDateChange(formData: FormData) {
  const customer = await getCustomerSession();
  if (!customer) {
    redirect("/account/register?reason=manage-dates");
  }
  await ensureKitchenSchema();
  const db = await requireDb();
  const orderId = Number(requiredString(formData, "order_id"));
  const selectedDays = formData.getAll("selected_days").map(String).filter(Boolean).sort();
  const order = await db
    .prepare(
      `SELECT id, order_type, selected_days
       FROM orders
       WHERE id = ? AND customer_id = ?`,
    )
    .bind(orderId, customer.id)
    .first<{ id: number; order_type: string; selected_days: string | null }>();
  if (!order || (order.order_type !== "weekly" && order.order_type !== "monthly")) {
    throw new Error("Only weekly and monthly orders can change pickup dates.");
  }
  const maxDays = order.order_type === "weekly" ? 5 : 20;
  if (selectedDays.length === 0 || selectedDays.length > maxDays) {
    throw new Error(`Please choose up to ${maxDays} pickup dates.`);
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const cutoff = tomorrow.toISOString().slice(0, 10);
  if (selectedDays.some((day) => day <= cutoff)) {
    throw new Error("Pickup date changes must be requested at least one day before pickup.");
  }
  await db
    .prepare(
      `INSERT INTO order_date_change_requests
       (order_id, customer_id, old_selected_days, requested_selected_days, notes)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      order.id,
      customer.id,
      order.selected_days,
      selectedDays.join(","),
      optionalString(formData, "notes"),
    )
    .run();
  revalidatePath("/my-orders");
  redirect("/my-orders?requested=dates");
}

export async function updatePricingRule(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const ruleId = Number(requiredString(formData, "id"));
  const pricingMethod = requiredString(formData, "pricing_method");
  const fixedUnit =
    pricingMethod === "fixed_unit_price"
      ? Math.round(Number(formData.get("fixed_unit_price") ?? 0) * 100)
      : null;
  const discountPercent =
    pricingMethod === "percent_discount"
      ? Number(formData.get("discount_percent") ?? 0)
      : null;
  const isActive = formData.get("is_active") === "on" ? 1 : 0;
  
  await db
    .prepare(
      `UPDATE pricing_rules
       SET name = ?, description = ?, rule_type = 'bulk', pricing_method = ?,
           applies_to = ?, menu_item_id = ?, category_id = ?, minimum_quantity = ?,
           discount_percent = ?, fixed_unit_price_cents = ?, start_date = ?,
           end_date = ?, requires_admin_approval = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(
      requiredString(formData, "name"),
      optionalString(formData, "description"),
      pricingMethod,
      requiredString(formData, "applies_to"),
      Number(formData.get("menu_item_id") || 0) || null,
      Number(formData.get("category_id") || 0) || null,
      Number(formData.get("minimum_quantity") ?? 2),
      discountPercent,
      fixedUnit,
      optionalString(formData, "start_date"),
      optionalString(formData, "end_date"),
      formData.get("requires_admin_approval") === "on" ? 1 : 0,
      isActive,
      ruleId,
    )
    .run();

  revalidatePath("/admin/pricing");
  revalidatePath("/order");
}

export async function deletePricingRule(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const ruleId = Number(requiredString(formData, "id"));

  await runOptionalMutation(db, "UPDATE order_pricing_adjustments SET pricing_rule_id = NULL WHERE pricing_rule_id = ?", [ruleId]);

  await db
    .prepare("DELETE FROM pricing_rules WHERE id = ?")
    .bind(ruleId)
    .run();

  revalidatePath("/admin/pricing");
  revalidatePath("/order");
}

export async function updateThaliPlan(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const planId = Number(requiredString(formData, "id"));
  const price = Number(formData.get("price") ?? 0);
  const effectiveFrom = requiredString(formData, "effective_from");
  const days = formData.getAll("available_days").join(",");
  const isActive = formData.get("active") === "on" ? 1 : 0;

  await db
    .prepare(
      `UPDATE thali_plans
       SET name = ?, description = ?, plan_type = ?, active = ?,
           available_days = ?, start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(
      requiredString(formData, "name"),
      optionalString(formData, "description"),
      requiredString(formData, "plan_type"),
      isActive,
      days,
      optionalString(formData, "start_date"),
      optionalString(formData, "end_date"),
      planId,
    )
    .run();

  const priceCents = Math.round(price * 100);
  const priceUpdateResult = await db
    .prepare(
      `UPDATE menu_prices
       SET price_cents = ?, effective_from = ?, updated_at = CURRENT_TIMESTAMP
       WHERE thali_plan_id = ? AND price_type = 'subscription' AND active = 1 AND effective_to IS NULL`,
    )
    .bind(priceCents, effectiveFrom, planId)
    .run();

  if ((priceUpdateResult.meta as { changes?: number }).changes === 0) {
    await db
      .prepare(
        `INSERT INTO menu_prices
         (thali_plan_id, price_type, price_cents, effective_from, active)
         VALUES (?, 'subscription', ?, ?, 1)`,
      )
      .bind(planId, priceCents, effectiveFrom)
      .run();
  }

  revalidatePath("/admin/pricing");
  revalidatePath("/order");
}

export async function deleteThaliPlan(formData: FormData) {
  await requireAdminSession();
  const db = await requireDb();
  const planId = Number(requiredString(formData, "id"));

  await db.prepare("DELETE FROM menu_prices WHERE thali_plan_id = ?").bind(planId).run();
  await db.prepare("DELETE FROM thali_plan_items WHERE thali_plan_id = ?").bind(planId).run();
  await runOptionalMutation(db, "UPDATE order_items SET thali_plan_id = NULL WHERE thali_plan_id = ?", [planId]);

  await db
    .prepare("DELETE FROM thali_plans WHERE id = ?")
    .bind(planId)
    .run();

  revalidatePath("/admin/pricing");
  revalidatePath("/order");
}
