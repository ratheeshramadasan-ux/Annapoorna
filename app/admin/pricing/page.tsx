import {
  addPricingRule,
  addThaliPlan,
  updatePricingRule,
  deletePricingRule,
  updateThaliPlan,
  deleteThaliPlan,
} from "@/app/actions";
import AdminShell from "@/components/AdminShell";
import DataTable from "@/components/DataTable";
import DateRangeFilter from "@/components/DateRangeFilter";
import DeleteConfirmButton from "@/components/DeleteConfirmButton";
import { requireAdminSession } from "@/lib/auth";
import { resolveDateRange, todayLocal, type DateRangeSearchParams } from "@/lib/date-range";
import { all, ensureKitchenSchema, formatMoney, first } from "@/lib/db";
import type { Customer, MenuCategory, MenuItem, PricingRule, ThaliPlan } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams & { editRuleId?: string; editThaliId?: string }>;
}) {
  await requireAdminSession();
  await ensureKitchenSchema();
  
  const resolvedParams = await searchParams;
  const range = resolveDateRange(resolvedParams);
  const editRuleId = resolvedParams.editRuleId ? Number(resolvedParams.editRuleId) : null;
  const editThaliId = resolvedParams.editThaliId ? Number(resolvedParams.editThaliId) : null;

  const [rows, items, categories, customers, assignments, editRule, editThali] = await Promise.all([
    all<PricingRule>(
      `SELECT *
       FROM pricing_rules
       WHERE COALESCE(start_date, date(created_at)) <= ?
         AND COALESCE(end_date, ?) >= ?
       ORDER BY is_active DESC, priority DESC, name`,
      [range.to, range.to, range.from],
    ),
    all<MenuItem>("SELECT * FROM menu_items ORDER BY name"),
    all<MenuCategory>("SELECT * FROM menu_categories ORDER BY sort_order, name"),
    all<Customer>("SELECT * FROM customers WHERE status != 'inactive' ORDER BY full_name"),
    all<{ pricing_rule_id: number; customer_id: number }>(
      "SELECT pricing_rule_id, customer_id FROM pricing_rule_customers",
    ),
    editRuleId
      ? first<PricingRule>("SELECT * FROM pricing_rules WHERE id = ?", [editRuleId])
      : null,
    editThaliId
      ? first<ThaliPlan & { price_cents?: number; effective_from?: string }>(
          `SELECT tp.*, mp.price_cents, mp.effective_from
           FROM thali_plans tp
           LEFT JOIN menu_prices mp ON mp.thali_plan_id = tp.id AND mp.price_type = 'subscription' AND mp.active = 1 AND mp.effective_to IS NULL
           WHERE tp.id = ?`,
          [editThaliId],
        )
      : null,
  ]);

  const thaliPlans = await all<ThaliPlan & { price_cents?: number }>(
    `SELECT tp.*, mp.price_cents
     FROM thali_plans tp
     LEFT JOIN menu_prices mp ON mp.thali_plan_id = tp.id AND mp.price_type = 'subscription' AND mp.active = 1 AND mp.effective_to IS NULL
     ORDER BY tp.plan_type, tp.name`,
  );

  return (
    <AdminShell title="Pricing">
      <DateRangeFilter basePath="/admin/pricing" from={range.from} to={range.to} label="Pricing active range" />
      
      {editRule ? (
        <form action={updatePricingRule} className="admin-form-grid">
          <input type="hidden" name="id" value={editRule.id} />
          <h3 style={{ gridColumn: "1 / -1", margin: "0 0 10px", color: "var(--gold)" }}>Edit Pricing Rule</h3>
          <label>
            Rule name
            <input name="name" defaultValue={editRule.name} required />
          </label>
          <label>
            Rule type
            <select name="rule_scope" defaultValue={editRule.rule_type === "customer" ? "customer" : "bulk"}>
              <option value="bulk">Bulk/general pricing</option>
              <option value="customer">Specific customers</option>
            </select>
          </label>
          <label>
            Applies to
            <select name="applies_to" defaultValue={editRule.applies_to}>
              <option value="all_items">All items</option>
              <option value="specific_item">Specific item</option>
              <option value="category">Category</option>
            </select>
          </label>
          <label className="wide-field" style={{ gridColumn: "span 2" }}>
            Special-price customers
            <select
              name="customer_ids"
              multiple
              size={Math.min(8, Math.max(3, customers.length))}
              defaultValue={assignments
                .filter((entry) => entry.pricing_rule_id === editRule.id)
                .map((entry) => String(entry.customer_id))}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name} - {customer.phone}
                </option>
              ))}
            </select>
            <small>Use Ctrl/Command to add or remove multiple customers.</small>
          </label>
          <label>
            Item
            <select name="menu_item_id" defaultValue={editRule.menu_item_id ?? ""}>
              <option value="">Any</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select name="category_id" defaultValue={editRule.category_id ?? ""}>
              <option value="">Any</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Minimum quantity
            <input name="minimum_quantity" type="number" min="1" defaultValue={editRule.minimum_quantity ?? 1} />
          </label>
          <label>
            Method
            <select name="pricing_method" defaultValue={editRule.pricing_method}>
              <option value="fixed_unit_price">Fixed unit price</option>
              <option value="percent_discount">Percent discount</option>
            </select>
          </label>
          <label>
            Fixed unit price
            <input name="fixed_unit_price" type="number" step="0.01" min="0" defaultValue={editRule.fixed_unit_price_cents ? (editRule.fixed_unit_price_cents / 100).toFixed(2) : ""} />
          </label>
          <label>
            Discount percent
            <input name="discount_percent" type="number" step="0.01" min="0" defaultValue={editRule.discount_percent ?? ""} />
          </label>
          <label>
            Start date
            <input name="start_date" type="date" defaultValue={editRule.start_date ?? todayLocal()} />
          </label>
          <label>
            End date
            <input name="end_date" type="date" defaultValue={editRule.end_date ?? ""} />
          </label>
          <label className="checkbox-line">
            <input name="requires_admin_approval" type="checkbox" defaultChecked={editRule.requires_admin_approval === 1} />
            Needs approval
          </label>
          <label className="checkbox-line">
            <input name="is_active" type="checkbox" defaultChecked={editRule.is_active === 1} />
            Active
          </label>
          <label className="wide-field" style={{ gridColumn: "1 / -1" }}>
            Description
            <input name="description" defaultValue={editRule.description ?? ""} />
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="submit">Save rule</button>
            <a href="/admin/pricing" className="outline-button" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Cancel</a>
          </div>
        </form>
      ) : (
        <form action={addPricingRule} className="admin-form-grid">
          <label>
            Rule name
            <input name="name" required />
          </label>
          <label>
            Rule type
            <select name="rule_scope" defaultValue="customer">
              <option value="customer">Specific customers</option>
              <option value="bulk">Bulk/general pricing</option>
            </select>
          </label>
          <label>
            Applies to
            <select name="applies_to" defaultValue="all_items">
              <option value="all_items">All items</option>
              <option value="specific_item">Specific item</option>
              <option value="category">Category</option>
            </select>
          </label>
          <label className="wide-field" style={{ gridColumn: "span 2" }}>
            Special-price customers
            <select name="customer_ids" multiple size={Math.min(8, Math.max(3, customers.length))}>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name} - {customer.phone}
                </option>
              ))}
            </select>
            <small>Use Ctrl/Command to select multiple customers.</small>
          </label>
          <label>
            Item
            <select name="menu_item_id">
              <option value="">Any</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select name="category_id">
              <option value="">Any</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Minimum quantity
            <input name="minimum_quantity" type="number" min="1" defaultValue="1" />
          </label>
          <label>
            Method
            <select name="pricing_method" defaultValue="fixed_unit_price">
              <option value="fixed_unit_price">Fixed unit price</option>
              <option value="percent_discount">Percent discount</option>
            </select>
          </label>
          <label>
            Fixed unit price
            <input name="fixed_unit_price" type="number" step="0.01" min="0" />
          </label>
          <label>
            Discount percent
            <input name="discount_percent" type="number" step="0.01" min="0" />
          </label>
          <label>
            Start date
            <input name="start_date" type="date" defaultValue={todayLocal()} />
          </label>
          <label>
            End date
            <input name="end_date" type="date" />
          </label>
          <label className="checkbox-line">
            <input name="requires_admin_approval" type="checkbox" />
            Needs approval
          </label>
          <label>
            Description
            <input name="description" />
          </label>
          <button type="submit">Add rule</button>
        </form>
      )}

      <DataTable
        headers={["Rule", "Type", "Customers", "Minimum", "Value", "Approval", "Active", "Actions"]}
        rows={rows.map((rule) => [
          rule.name,
          rule.rule_type === "customer" ? "Customer special" : rule.pricing_method,
          assignments
            .filter((entry) => entry.pricing_rule_id === rule.id)
            .map((entry) => customers.find((customer) => customer.id === entry.customer_id)?.full_name)
            .filter(Boolean)
            .join(", ") || "—",
          rule.minimum_quantity,
          rule.fixed_unit_price_cents
            ? formatMoney(rule.fixed_unit_price_cents)
            : rule.fixed_total_price_cents
              ? formatMoney(rule.fixed_total_price_cents)
              : rule.discount_percent
                ? `${rule.discount_percent}%`
                : rule.discount_amount_cents
                  ? formatMoney(rule.discount_amount_cents)
                  : "Special",
          rule.requires_admin_approval ? "Yes" : "No",
          rule.is_active ? "Yes" : "No",
          <div className="table-actions" key={rule.id}>
            <a href={`/admin/pricing?editRuleId=${rule.id}`} className="edit-link">
              Edit
            </a>
            <DeleteConfirmButton
              action={deletePricingRule}
              id={rule.id}
              confirmMessage={`Are you sure you want to delete pricing rule "${rule.name}"?`}
            />
          </div>,
        ])}
      />

      {editThali ? (
        <form action={updateThaliPlan} className="admin-form-grid">
          <input type="hidden" name="id" value={editThali.id} />
          <h3 style={{ gridColumn: "1 / -1", margin: "0 0 10px", color: "var(--gold)" }}>Edit Thali Plan</h3>
          <label>
            Thali name
            <input name="name" defaultValue={editThali.name} required />
          </label>
          <label>
            Type
            <select name="plan_type" defaultValue={editThali.plan_type}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label>
            Price
            <input name="price" type="number" step="0.01" min="0" required defaultValue={editThali.price_cents ? (editThali.price_cents / 100).toFixed(2) : ""} />
          </label>
          <label>
            Effective from
            <input name="effective_from" type="date" required defaultValue={editThali.effective_from ?? todayLocal()} />
          </label>
          <label>
            Start date
            <input name="start_date" type="date" defaultValue={editThali.start_date ?? todayLocal()} />
          </label>
          <label>
            End date
            <input name="end_date" type="date" defaultValue={editThali.end_date ?? ""} />
          </label>
          <fieldset className="admin-fieldset">
            <legend>Available days</legend>
            {[["0", "Sun"], ["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"]].map(([value, label]) => {
              const isChecked = editThali.available_days?.split(",").includes(value) ?? false;
              return (
                <label key={value} className="checkbox-line">
                  <input name="available_days" type="checkbox" value={value} defaultChecked={isChecked} />
                  {label}
                </label>
              );
            })}
          </fieldset>
          <label className="checkbox-line">
            <input name="active" type="checkbox" defaultChecked={editThali.active === 1} />
            Active
          </label>
          <label className="wide-field" style={{ gridColumn: "1 / -1" }}>
            Description
            <input name="description" defaultValue={editThali.description ?? ""} />
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="submit">Save thali plan</button>
            <a href="/admin/pricing" className="outline-button" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Cancel</a>
          </div>
        </form>
      ) : (
        <form action={addThaliPlan} className="admin-form-grid">
          <label>
            Thali name
            <input name="name" required />
          </label>
          <label>
            Type
            <select name="plan_type" defaultValue="daily">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label>
            Price
            <input name="price" type="number" step="0.01" min="0" required />
          </label>
          <label>
            Effective from
            <input name="effective_from" type="date" required defaultValue={todayLocal()} />
          </label>
          <label>
            Start date
            <input name="start_date" type="date" defaultValue={todayLocal()} />
          </label>
          <label>
            End date
            <input name="end_date" type="date" />
          </label>
          <fieldset className="admin-fieldset">
            <legend>Available days</legend>
            {[["0", "Sun"], ["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"]].map(([value, label]) => (
              <label key={value} className="checkbox-line">
                <input name="available_days" type="checkbox" value={value} />
                {label}
              </label>
            ))}
          </fieldset>
          <label className="wide-field">
            Description
            <input name="description" />
          </label>
          <button type="submit">Add thali plan</button>
        </form>
      )}

      <DataTable
        headers={["Thali plan", "Type", "Price", "Days", "Active", "Actions"]}
        rows={thaliPlans.map((plan) => [
          plan.name,
          plan.plan_type,
          plan.price_cents ? formatMoney(plan.price_cents) : "N/A",
          plan.available_days ?? "All days",
          plan.active ? "Yes" : "No",
          <div className="table-actions" key={plan.id}>
            <a href={`/admin/pricing?editThaliId=${plan.id}`} className="edit-link">
              Edit
            </a>
            <DeleteConfirmButton
              action={deleteThaliPlan}
              id={plan.id}
              confirmMessage={`Are you sure you want to delete thali plan "${plan.name}"? This will delete all its prices and plan items.`}
            />
          </div>,
        ])}
      />
    </AdminShell>
  );
}
