import { createHoliday, refundHolidayOrder, updateHoliday } from "@/app/actions";
import AdminShell from "@/components/AdminShell";
import DataTable from "@/components/DataTable";
import { requireAdminSession } from "@/lib/auth";
import { all, ensureKitchenSchema, formatMoney, formatPickupDate } from "@/lib/db";
import type { Holiday, Order } from "@/lib/types";

export const dynamic = "force-dynamic";

type HolidayOrder = Pick<
  Order,
  | "id"
  | "order_number"
  | "customer_name"
  | "customer_phone"
  | "customer_email"
  | "pickup_date"
  | "pickup_time"
  | "selected_days"
  | "total_cents"
  | "payment_status"
  | "status"
>;

function holidayEnd(holiday: Holiday) {
  return holiday.end_date || holiday.holiday_date;
}

function orderAffectedByHoliday(order: HolidayOrder, holiday: Holiday) {
  const start = holiday.holiday_date;
  const end = holidayEnd(holiday);
  if (order.pickup_date >= start && order.pickup_date <= end) {
    return true;
  }
  return (order.selected_days ?? "")
    .split(",")
    .map((date) => date.trim())
    .filter(Boolean)
    .some((date) => date >= start && date <= end);
}

export default async function AdminHolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; holiday?: string }>;
}) {
  await requireAdminSession();
  await ensureKitchenSchema();
  const params = await searchParams;
  const [holidays, orders] = await Promise.all([
    all<Holiday>(
      `SELECT id, name, holiday_date, end_date, notice_message, is_active, created_at
       FROM holidays
       ORDER BY holiday_date DESC, id DESC`,
    ),
    all<HolidayOrder>(
      `SELECT id, order_number, customer_name, customer_phone, customer_email,
              pickup_date, pickup_time, selected_days, total_cents, payment_status, status
       FROM orders
       WHERE status NOT IN ('cancelled')
       ORDER BY pickup_date ASC, created_at ASC
       LIMIT 500`,
    ),
  ]);
  const selectedHoliday =
    holidays.find((holiday) => String(holiday.id) === params.holiday) ?? holidays[0] ?? null;
  const affectedOrders = selectedHoliday
    ? orders.filter((order) => orderAffectedByHoliday(order, selectedHoliday))
    : [];

  return (
    <AdminShell title="Holidays">
      {params.saved === "created" ? (
        <p className="admin-flash">Holiday saved. Active holiday dates are blocked on the order page.</p>
      ) : null}
      {params.saved === "updated" ? (
        <p className="admin-flash">Holiday updated successfully.</p>
      ) : null}
      {params.saved === "refund" ? (
        <p className="admin-flash">Holiday refund recorded and customer notice queued.</p>
      ) : null}

      <form action={createHoliday} className="admin-form-grid holiday-form">
        <div className="form-intro">
          <h3>Add Holiday</h3>
          <p>Active holidays are blocked automatically in the public order date selection.</p>
        </div>
        <label>
          Holiday name
          <input name="name" placeholder="Onam / Family vacation" required />
        </label>
        <label>
          Start date
          <input name="holiday_date" type="date" required />
        </label>
        <label>
          End date
          <input name="end_date" type="date" />
        </label>
        <label className="checkbox-line">
          <input name="is_active" type="checkbox" defaultChecked />
          Active
        </label>
        <label className="checkbox-line">
          <input name="send_notice" type="checkbox" defaultChecked />
          Queue customer notice
        </label>
        <label className="wide-field">
          Customer notice message
          <textarea
            name="notice_message"
            rows={4}
            placeholder="Leave blank to use the default holiday notice."
          />
        </label>
        <button type="submit">Add holiday</button>
      </form>

      <section className="admin-panel">
        <div className="section-heading-row">
          <div>
            <h3>Holiday Calendar</h3>
            <p>Choose a holiday below to review affected bookings and refunds.</p>
          </div>
        </div>
        <DataTable
          headers={["Holiday", "Dates", "Status", "Affected", "Edit"]}
          rows={holidays.map((holiday) => {
            const affectedCount = orders.filter((order) => orderAffectedByHoliday(order, holiday)).length;
            return [
              holiday.name,
              holiday.holiday_date === holidayEnd(holiday)
                ? formatPickupDate(holiday.holiday_date)
                : `${formatPickupDate(holiday.holiday_date)} to ${formatPickupDate(holidayEnd(holiday))}`,
              holiday.is_active ? "Active" : "Inactive",
              <a key={`affected-${holiday.id}`} href={`/admin/holidays?holiday=${holiday.id}`}>
                {affectedCount} booking{affectedCount === 1 ? "" : "s"}
              </a>,
              <form key={`edit-${holiday.id}`} action={updateHoliday} className="inline-form holiday-inline-form">
                <input type="hidden" name="holiday_id" value={holiday.id} />
                <input name="name" defaultValue={holiday.name} required />
                <input name="holiday_date" type="date" defaultValue={holiday.holiday_date} required />
                <input name="end_date" type="date" defaultValue={holiday.end_date ?? ""} />
                <input name="notice_message" defaultValue={holiday.notice_message ?? ""} aria-label="Notice message" />
                <label className="checkbox-line">
                  <input name="is_active" type="checkbox" defaultChecked={holiday.is_active === 1} />
                  Active
                </label>
                <label className="checkbox-line">
                  <input name="send_notice" type="checkbox" />
                  Notice
                </label>
                <button type="submit">Save</button>
              </form>,
            ];
          })}
        />
      </section>

      <section className="admin-panel">
        <div className="section-heading-row">
          <div>
            <h3>Affected Bookings</h3>
            <p>
              {selectedHoliday
                ? `${selectedHoliday.name}: ${affectedOrders.length} active booking${affectedOrders.length === 1 ? "" : "s"} found.`
                : "Add a holiday to see affected bookings."}
            </p>
          </div>
        </div>
        <DataTable
          headers={["Order", "Customer", "Pickup", "Payment", "Total", "Refund"]}
          rows={affectedOrders.map((order) => [
            order.order_number,
            `${order.customer_name} - ${order.customer_phone}${order.customer_email ? ` - ${order.customer_email}` : ""}`,
            `${formatPickupDate(order.pickup_date)} ${order.pickup_time}`,
            order.payment_status,
            formatMoney(order.total_cents),
            selectedHoliday ? (
              <form key={`refund-${order.id}`} action={refundHolidayOrder} className="inline-form">
                <input type="hidden" name="holiday_id" value={selectedHoliday.id} />
                <input type="hidden" name="order_id" value={order.id} />
                <input
                  name="refund_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={(order.total_cents / 100).toFixed(2)}
                  aria-label="Refund amount"
                />
                <button type="submit">Record refund</button>
              </form>
            ) : null,
          ])}
        />
      </section>
    </AdminShell>
  );
}
