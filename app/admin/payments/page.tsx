import { recordPayment } from "@/app/actions";
import AdminShell from "@/components/AdminShell";
import DataTable from "@/components/DataTable";
import DateRangeFilter from "@/components/DateRangeFilter";
import { requireAdminSession } from "@/lib/auth";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { all, formatMoney } from "@/lib/db";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: number;
  order_number: string | null;
  payment_method: string;
  payment_status: string;
  expected_amount_cents: number;
  received_amount_cents: number;
  payment_reference: string | null;
  notes: string | null;
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams>;
}) {
  await requireAdminSession();
  const range = resolveDateRange(await searchParams);
  const [rows, orders] = await Promise.all([
    all<PaymentRow>(
      `SELECT p.*, o.order_number
       FROM payments p
       LEFT JOIN orders o ON o.id = p.order_id
       WHERE date(p.created_at) BETWEEN ? AND ?
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [range.from, range.to],
    ),
    all<Order>(
      "SELECT * FROM orders WHERE payment_status != 'verified' ORDER BY created_at DESC LIMIT 100",
    ),
  ]);

  return (
    <AdminShell title="Payments">
      <DateRangeFilter basePath="/admin/payments" from={range.from} to={range.to} label="Payment date range" />
      <form action={recordPayment} className="admin-form-grid">
        <label>
          Order
          <select name="order_id" required>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.order_number} - {formatMoney(order.total_cents)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Method
          <select name="payment_method" defaultValue="interac">
            <option value="interac">Interac</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Status
          <select name="payment_status" defaultValue="verified">
            <option value="pending_verification">Pending verification</option>
            <option value="paid">Paid</option>
            <option value="verified">Verified</option>
          </select>
        </label>
        <label>
          Received amount
          <input name="received_amount" type="number" step="0.01" min="0" required />
        </label>
        <label>
          Reference
          <input name="payment_reference" />
        </label>
        <label>
          Notes
          <input name="notes" />
        </label>
        <button type="submit">Record payment</button>
      </form>

      <DataTable
        headers={["Order", "Method", "Status", "Expected", "Received", "Ref", "Notes"]}
        rows={rows.map((payment) => [
          payment.order_number ?? "Unlinked",
          payment.payment_method,
          payment.payment_status,
          formatMoney(payment.expected_amount_cents),
          formatMoney(payment.received_amount_cents),
          payment.payment_reference ?? "",
          payment.notes ?? "",
        ])}
      />
    </AdminShell>
  );
}
