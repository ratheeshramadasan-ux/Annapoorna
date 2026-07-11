import { updateOrderStatus } from "@/app/actions";
import AdminCalendarOrderForm from "@/components/AdminCalendarOrderForm";
import AdminShell from "@/components/AdminShell";
import DataTable from "@/components/DataTable";
import DateRangeFilter from "@/components/DateRangeFilter";
import DeleteOrderButton from "@/components/DeleteOrderButton";
import OrderEditForm from "@/components/OrderEditForm";
import OrderPaymentForm from "@/components/OrderPaymentForm";
import { requireAdminSession } from "@/lib/auth";
import { resolveDateRange, todayLocal, type DateRangeSearchParams } from "@/lib/date-range";
import { all, ensureKitchenSchema, formatMoney, formatPickupDate } from "@/lib/db";
import type { Customer, CustomerPricingRule, MenuAvailability, MenuItem, Order } from "@/lib/types";

export const dynamic = "force-dynamic";

type AdminOrderRow = Order & {
  received_amount_cents: number | null;
  payment_method: string | null;
};

function orderAppliesToRange(order: Order, from: string, to: string) {
  if (order.pickup_date >= from && order.pickup_date <= to) return true;
  return (order.selected_days ?? "")
    .split(",")
    .some((date) => date >= from && date <= to);
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams & { saved?: string }>;
}) {
  await requireAdminSession();
  await ensureKitchenSchema();
  const params = await searchParams;
  const range = resolveDateRange(params);
  const [candidateRows, customers, menuItems, availability, customerPricingRules] = await Promise.all([
    all<AdminOrderRow>(
      `SELECT o.*,
            (
              SELECT p.received_amount_cents
              FROM payments p
              WHERE p.order_id = o.id
              ORDER BY p.id DESC
              LIMIT 1
            ) AS received_amount_cents,
            (
              SELECT p.payment_method
              FROM payments p
              WHERE p.order_id = o.id
              ORDER BY p.id DESC
              LIMIT 1
            ) AS payment_method
     FROM orders o
     WHERE o.pickup_date BETWEEN ? AND ? OR o.selected_days IS NOT NULL
     ORDER BY o.pickup_date DESC, o.created_at DESC
     LIMIT 200`,
      [range.from, range.to],
    ),
    all<Customer>("SELECT * FROM customers WHERE status != 'inactive' ORDER BY full_name LIMIT 500"),
    all<MenuItem>(
      `SELECT mi.*, mc.name AS category_name,
              COALESCE((
                SELECT mp.price_cents
                FROM menu_prices mp
                WHERE mp.menu_item_id = mi.id
                  AND mp.price_type = 'regular'
                  AND mp.active = 1
                  AND mp.effective_from <= date('now')
                  AND (mp.effective_to IS NULL OR mp.effective_to >= date('now'))
                ORDER BY mp.effective_from DESC, mp.id DESC
                LIMIT 1
              ), mi.base_price_cents) AS effective_price_cents
       FROM menu_items mi
       LEFT JOIN menu_categories mc ON mc.id = mi.category_id
       WHERE mi.is_active = 1
       ORDER BY mc.sort_order, mi.sort_order, mi.name`,
    ),
    all<MenuAvailability>(
      "SELECT * FROM menu_item_availability WHERE is_active = 1 ORDER BY menu_item_id, day_of_week",
    ),
    all<CustomerPricingRule>(
      `SELECT pr.*, prc.customer_id
       FROM pricing_rules pr
       JOIN pricing_rule_customers prc ON prc.pricing_rule_id = pr.id
       WHERE pr.rule_type = 'customer' AND pr.is_active = 1
       ORDER BY pr.priority DESC, pr.id DESC`,
    ),
  ]);
  const rows = candidateRows.filter((order) => orderAppliesToRange(order, range.from, range.to));

  return (
    <AdminShell title="Orders">
      <DateRangeFilter basePath="/admin/orders" from={range.from} to={range.to} label="Pickup date range" />
      {params.saved === "status" ? (
        <p className="admin-flash">Order status updated successfully.</p>
      ) : null}
      {params.saved === "payment" ? (
        <p className="admin-flash">Payment details updated successfully.</p>
      ) : null}
      {params.saved === "details" ? (
        <p className="admin-flash">Order details updated successfully.</p>
      ) : null}
      {params.saved === "deleted" ? (
        <p className="admin-flash">Order deleted successfully.</p>
      ) : null}
      {params.saved === "historical" ? (
        <p className="admin-flash">Past order added successfully.</p>
      ) : null}
      <section className="admin-section-block">
        <h3>Add past order</h3>
        <p className="admin-note">Select the customer and menu, then click every applicable date.</p>
        <AdminCalendarOrderForm
          customers={customers}
          menuItems={menuItems}
          availability={availability}
          customerPricingRules={customerPricingRules}
          today={todayLocal()}
        />
      </section>
      <DataTable
        headers={["Order", "Customer", "Pickup", "Edit", "Order status", "Payment", "Total", "Delete"]}
        rows={rows.map((order) => [
          order.order_number,
          `${order.customer_name} - ${order.customer_phone}`,
          `${formatPickupDate(order.pickup_date)} ${order.pickup_time}`,
          <OrderEditForm key={`edit-${order.id}`} order={order} from={range.from} to={range.to} />,
          <form
            key={`status-${order.id}`}
            action={updateOrderStatus}
            className="inline-form"
          >
            <input type="hidden" name="order_id" value={order.id} />
            <input type="hidden" name="from" value={range.from} />
            <input type="hidden" name="to" value={range.to} />
            <select name="status" defaultValue={order.status}>
              <option value="pending_approval">Pending approval</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button type="submit">Save</button>
          </form>,
          <OrderPaymentForm
            key={`payment-${order.id}`}
            orderId={order.id}
            paymentStatus={order.payment_status}
            paymentMethod={order.payment_method}
            amountReceivedCents={order.received_amount_cents}
            totalCents={order.total_cents}
            from={range.from}
            to={range.to}
          />,
          formatMoney(order.total_cents),
          <DeleteOrderButton
            key={`delete-${order.id}`}
            orderId={order.id}
            orderNumber={order.order_number}
            from={range.from}
            to={range.to}
          />,
        ])}
      />
    </AdminShell>
  );
}
