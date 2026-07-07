import {
  updateAdminAlertSettings,
  updateDeliverySettings,
  updateHomeContent,
  updateOrderNotificationSettings,
  updateReviewSettings,
  updateSetting,
} from "@/app/actions";
import AdminShell from "@/components/AdminShell";
import DataTable from "@/components/DataTable";
import { requireAdminSession } from "@/lib/auth";
import { all, ensureKitchenSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

type SettingRow = {
  key: string;
  value: string;
  value_type: string;
  category: string | null;
  is_public: number;
};

type AdminAlertRow = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  whatsapp_number: string | null;
  email_alert_enabled: number | null;
  whatsapp_alert_enabled: number | null;
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdminSession();
  await ensureKitchenSchema();
  const params = await searchParams;
  const rows = await all<SettingRow>(
    "SELECT key, value, value_type, category, is_public FROM app_settings ORDER BY category, key",
  );
  const admins = await all<AdminAlertRow>(
    `SELECT id, email, name, role, whatsapp_number, email_alert_enabled, whatsapp_alert_enabled
     FROM admin_users
     WHERE status = 'approved'
     ORDER BY role DESC, email`,
  );
  const valueFor = (key: string) => rows.find((row) => row.key === key)?.value ?? "";
  const valueOrDefault = (key: string, fallback: string) => valueFor(key) || fallback;
  const customerMessageDefault = [
    "Hi {customer_name},",
    "",
    "Your Annapoorna order {order_number} has been received for {date}.",
    "Track your order here: {link}",
    "",
    "{admin_signature}",
  ].join("\n");
  const adminMessageDefault = [
    "New Annapoorna order {order_number}",
    "Customer: {customer_name}",
    "Date: {date}",
    "Link: {link}",
    "",
    "{admin_signature}",
  ].join("\n");

  return (
    <AdminShell title="Settings">
      {params.saved === "alerts" ? (
        <p className="admin-flash">Admin alert settings saved successfully.</p>
      ) : null}
      {params.saved === "order-messages" ? (
        <p className="admin-flash">Order message templates saved successfully.</p>
      ) : null}
      <form action={updateDeliverySettings} className="delivery-settings-card">
        <div>
          <h3>Delivery Settings</h3>
          <p>Delivery is off by default. The order page only shows delivery when enabled here.</p>
        </div>
        <label className="checkbox-line">
          <input
            name="delivery_enabled"
            type="checkbox"
            defaultChecked={valueFor("delivery_enabled") === "true"}
          />
          Enable delivery
        </label>
        <label>
          Delivery fee
          <input name="delivery_fee" type="number" step="0.01" defaultValue={valueFor("delivery_fee") || "0"} />
        </label>
        <label>
          Minimum order amount
          <input
            name="delivery_min_order_amount"
            type="number"
            step="0.01"
            defaultValue={valueFor("delivery_min_order_amount") || "0"}
          />
        </label>
        <label className="wide-field">
          Service area note
          <input name="delivery_service_area_note" defaultValue={valueFor("delivery_service_area_note")} />
        </label>
        <button type="submit">Save delivery settings</button>
      </form>

      <form action={updateReviewSettings} className="delivery-settings-card">
        <div>
          <h3>Review Settings</h3>
          <p>Control public review submission and link customers to Google reviews.</p>
        </div>
        <label className="checkbox-line">
          <input
            name="public_allow_reviews"
            type="checkbox"
            defaultChecked={valueFor("public_allow_reviews") !== "false"}
          />
          Enable website reviews
        </label>
        <label className="wide-field">
          Google review URL
          <input
            name="google_review_url"
            type="url"
            placeholder="https://g.page/r/..."
            defaultValue={valueFor("google_review_url")}
          />
        </label>
        <button type="submit">Save review settings</button>
      </form>

      <form action={updateAdminAlertSettings} className="delivery-settings-card admin-alert-settings">
        <div>
          <h3>Admin Order Alerts</h3>
          <p>Choose which approved admins receive queued email or WhatsApp alerts when a new order arrives.</p>
        </div>
        <div className="admin-alert-grid">
          {admins.map((admin) => (
            <div className="admin-alert-row" key={admin.id}>
              <input type="hidden" name="admin_id" value={admin.id} />
              <div>
                <strong>{admin.name || admin.email}</strong>
                <span>{admin.email}</span>
              </div>
              <label className="checkbox-line">
                <input
                  name={`email_alert_enabled_${admin.id}`}
                  type="checkbox"
                  defaultChecked={admin.email_alert_enabled !== 0}
                />
                Email
              </label>
              <label className="checkbox-line">
                <input
                  name={`whatsapp_alert_enabled_${admin.id}`}
                  type="checkbox"
                  defaultChecked={admin.whatsapp_alert_enabled !== 0}
                />
                WhatsApp
              </label>
              <label>
                WhatsApp number
                <input
                  name={`whatsapp_number_${admin.id}`}
                  defaultValue={admin.whatsapp_number ?? ""}
                  placeholder="+14034814101"
                />
              </label>
            </div>
          ))}
        </div>
        <button type="submit">Save admin alerts</button>
      </form>

      <form action={updateOrderNotificationSettings} className="delivery-settings-card message-template-card">
        <div>
          <h3>Order Messages</h3>
          <p>Manage the email and WhatsApp message format used after an order is placed.</p>
        </div>
        <div className="placeholder-list wide-field">
          {["{customer_name}", "{order_number}", "{date}", "{link}", "{admin_signature}"].map(
            (placeholder) => (
              <code key={placeholder}>{placeholder}</code>
            ),
          )}
        </div>
        <label className="wide-field">
          Customer message format
          <textarea
            name="order_customer_message_template"
            rows={7}
            defaultValue={valueOrDefault("order_customer_message_template", customerMessageDefault)}
            required
          />
        </label>
        <label className="wide-field">
          Admin message format
          <textarea
            name="order_admin_message_template"
            rows={6}
            defaultValue={valueOrDefault("order_admin_message_template", adminMessageDefault)}
            required
          />
        </label>
        <label className="wide-field">
          Portal admin signature
          <textarea
            name="portal_admin_signature"
            rows={3}
            defaultValue={valueOrDefault("portal_admin_signature", "Regards,\nTeam Annapoorna")}
            required
          />
        </label>
        <label>
          Email from address
          <input
            name="notification_from_email"
            type="email"
            placeholder="orders@your-domain.com"
            defaultValue={valueFor("notification_from_email") || valueFor("business_email")}
          />
        </label>
        <label>
          Email from name
          <input
            name="notification_from_name"
            placeholder="Annapoorna"
            defaultValue={valueOrDefault("notification_from_name", "Annapoorna")}
          />
        </label>
        <button type="submit">Save order messages</button>
      </form>

      <form action={updateHomeContent} className="delivery-settings-card home-content-card">
        <div>
          <h3>Home Page Content</h3>
          <p>Edit one line per item. These populate the three Home page cards.</p>
        </div>
        <label className="wide-field">
          Menu
          <textarea
            name="home_menu_lines"
            rows={5}
            defaultValue={valueFor("home_menu_lines")}
            required
          />
        </label>
        <label className="wide-field">
          Pickup Details
          <textarea
            name="home_pickup_lines"
            rows={5}
            defaultValue={valueFor("home_pickup_lines")}
            required
          />
        </label>
        <label className="wide-field">
          Perfect For
          <textarea
            name="home_perfect_for_lines"
            rows={5}
            defaultValue={valueFor("home_perfect_for_lines")}
            required
          />
        </label>
        <button type="submit">Save home content</button>
      </form>

      <DataTable
        headers={["Key", "Value", "Type", "Category", "Public", "Edit"]}
        rows={rows.map((setting) => [
          setting.key,
          setting.value,
          setting.value_type,
          setting.category ?? "",
          setting.is_public ? "Yes" : "No",
          <form key={setting.key} action={updateSetting} className="inline-form">
            <input type="hidden" name="key" value={setting.key} />
            {setting.value_type === "boolean" ? (
              <select name="value" defaultValue={setting.value}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input name="value" defaultValue={setting.value} />
            )}
            <button type="submit">Save</button>
          </form>,
        ])}
      />
    </AdminShell>
  );
}
