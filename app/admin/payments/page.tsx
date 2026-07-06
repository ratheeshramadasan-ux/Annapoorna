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
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
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
      `SELECT p.*, o.order_number, c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
       FROM payments p
       LEFT JOIN orders o ON o.id = p.order_id
       LEFT JOIN customers c ON c.id = p.customer_id
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
          Payment date
          <input name="payment_date" type="date" defaultValue={range.to} required />
        </label>
        <label>
          Order optional
          <select name="order_id" defaultValue="">
            <option value="">Unlinked past payment</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.order_number} - {formatMoney(order.total_cents)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Customer name
          <input name="customer_name" placeholder="Required if no order" />
        </label>
        <label>
          Customer phone
          <input name="customer_phone" type="tel" placeholder="Required if no order" />
        </label>
        <label>
          Customer email
          <input name="customer_email" type="email" />
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
        headers={["Order", "Customer", "Method", "Status", "Expected", "Received", "Ref", "Notes"]}
        rows={rows.map((payment) => [
          payment.order_number ?? "Unlinked",
          payment.customer_name
            ? `${payment.customer_name} - ${payment.customer_phone ?? payment.customer_email ?? ""}`
            : "",
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
