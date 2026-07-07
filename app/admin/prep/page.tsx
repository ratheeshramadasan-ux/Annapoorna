import AdminShell from "@/components/AdminShell";
import DataTable from "@/components/DataTable";
import DateRangeFilter from "@/components/DateRangeFilter";
import { requireAdminSession } from "@/lib/auth";
import { formatPickupDate } from "@/lib/db";
import { all } from "@/lib/db";
import { currentWeekRange, todayLocal, type DateRangeSearchParams } from "@/lib/date-range";

export const dynamic = "force-dynamic";

type PrepOrder = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  pickup_date: string;
  pickup_time: string;
  selected_days: string | null;
  order_type: string;
  status: string;
  customer_notes: string | null;
  allergy_notes: string | null;
};

type PrepItem = {
  order_id: number;
  item_name_snapshot: string;
  quantity: number;
};

function addDays(dateValue: string, daysToAdd: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + daysToAdd);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function tomorrowRange() {
  const tomorrow = addDays(todayLocal(), 1);
  return { from: tomorrow, to: tomorrow };
}

function prepDateRange(params?: DateRangeSearchParams) {
  const fallback = tomorrowRange();
  return {
    from: params?.from || fallback.from,
    to: params?.to || fallback.to,
  };
}

function orderAppliesToRange(order: PrepOrder, from: string, to: string) {
  if (order.pickup_date >= from && order.pickup_date <= to) {
    return true;
  }
  return (order.selected_days ?? "")
    .split(",")
    .map((date) => date.trim())
    .filter(Boolean)
    .some((date) => date >= from && date <= to);
}

export default async function AdminPrepPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams>;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const range = prepDateRange(params);
  const tomorrow = tomorrowRange();
  const week = currentWeekRange();
  const candidateOrders = await all<PrepOrder>(
    `SELECT id, order_number, customer_name, customer_phone, customer_email,
            pickup_date, pickup_time, selected_days, order_type, status,
            customer_notes, allergy_notes
     FROM orders
     WHERE status NOT IN ('cancelled')
       AND (pickup_date BETWEEN ? AND ? OR selected_days IS NOT NULL)
     ORDER BY pickup_date ASC, pickup_time ASC, customer_name ASC
     LIMIT 500`,
    [range.from, range.to],
  );
  const orders = candidateOrders.filter((order) =>
    orderAppliesToRange(order, range.from, range.to),
  );
  const orderIds = orders.map((order) => order.id);
  const items =
    orderIds.length > 0
      ? await all<PrepItem>(
          `SELECT order_id, item_name_snapshot, quantity
           FROM order_items
           WHERE order_id IN (${orderIds.map(() => "?").join(",")})
           ORDER BY item_name_snapshot ASC`,
          orderIds,
        )
      : [];
  const itemTotals = Array.from(
    items
      .reduce((map, item) => {
        map.set(
          item.item_name_snapshot,
          (map.get(item.item_name_snapshot) ?? 0) + Number(item.quantity || 0),
        );
        return map;
      }, new Map<string, number>())
      .entries(),
  ).sort(([left], [right]) => left.localeCompare(right));

  return (
    <AdminShell title="Prep Plan">
      <div className="date-range-filter prep-quick-filter">
        <div>
          <strong>Prep date range</strong>
          <span>
            <a href={`/admin/prep?from=${tomorrow.from}&to=${tomorrow.to}`}>Tomorrow</a>
            <a href={`/admin/prep?from=${week.from}&to=${week.to}`}>Current week</a>
          </span>
        </div>
      </div>
      <DateRangeFilter
        basePath="/admin/prep"
        from={range.from}
        to={range.to}
        label="Custom prep range"
      />

      <section className="admin-cards prep-summary-cards">
        <div className="admin-card">
          <span>Orders</span>
          <strong>{orders.length}</strong>
        </div>
        <div className="admin-card">
          <span>Items to prepare</span>
          <strong>
            {itemTotals.reduce((sum, [, quantity]) => sum + quantity, 0)}
          </strong>
        </div>
        <div className="admin-card">
          <span>Customers</span>
          <strong>{new Set(orders.map((order) => order.customer_phone)).size}</strong>
        </div>
      </section>

      <section className="admin-panel">
        <div className="section-heading-row">
          <div>
            <h3>Kitchen Summary</h3>
            <p>
              {formatPickupDate(range.from)} to {formatPickupDate(range.to)}
            </p>
          </div>
        </div>
        <DataTable
          headers={["Item", "Total quantity"]}
          rows={itemTotals.map(([name, quantity]) => [name, quantity])}
        />
      </section>

      <section className="admin-panel">
        <div className="section-heading-row">
          <div>
            <h3>Customer List</h3>
            <p>Use this for confirmations, notes, and pickup planning.</p>
          </div>
        </div>
        <DataTable
          headers={["Pickup", "Order", "Customer", "Contact", "Items", "Notes"]}
          rows={orders.map((order) => {
            const orderItems = items
              .filter((item) => item.order_id === order.id)
              .map((item) => `${item.quantity} x ${item.item_name_snapshot}`)
              .join(", ");
            const notes = [order.allergy_notes, order.customer_notes]
              .filter(Boolean)
              .join(" / ");
            return [
              `${formatPickupDate(order.pickup_date)} ${order.pickup_time}`,
              `${order.order_number} (${order.order_type})`,
              order.customer_name,
              [order.customer_phone, order.customer_email].filter(Boolean).join(" / "),
              orderItems,
              notes,
            ];
          })}
        />
      </section>
    </AdminShell>
  );
}
