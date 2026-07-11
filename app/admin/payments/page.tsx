import { approvePaymentEdit, rejectPaymentEdit } from "@/app/actions";
import AdminShell from "@/components/AdminShell";
import AdminPaymentForm from "@/components/AdminPaymentForm";
import DataTable from "@/components/DataTable";
import DateRangeFilter from "@/components/DateRangeFilter";
import DeletePaymentButton from "@/components/DeletePaymentButton";
import EditPaymentForm from "@/components/EditPaymentForm";
import { requireAdminSession } from "@/lib/auth";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { all, formatMoney } from "@/lib/db";
import type { Customer, Order } from "@/lib/types";

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
  payment_date: string;
};

type PaymentApprovalRow = {
  id: number;
  payment_id: number;
  requested_payload: string;
  created_at: string;
  requester_email: string;
  customer_name: string | null;
  order_number: string | null;
};

type PaymentSearchParams = DateRangeSearchParams & {
  saved?: string;
  deleted?: string;
  updated?: string;
  approval_requested?: string;
  approved?: string;
  rejected?: string;
  q?: string;
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<PaymentSearchParams>;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const range = resolveDateRange(params);
  const customerSearch = params.q?.trim() ?? "";
  const customerPattern = `%${customerSearch}%`;
  const [rows, orders, customers, approvals] = await Promise.all([
    all<PaymentRow>(
      `SELECT p.*, date(p.created_at) AS payment_date, o.order_number,
              c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
       FROM payments p
       LEFT JOIN orders o ON o.id = p.order_id
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE date(p.created_at) BETWEEN ? AND ?
         AND (
           ? = ''
           OR c.full_name LIKE ? COLLATE NOCASE
           OR c.phone LIKE ?
           OR c.email LIKE ? COLLATE NOCASE
         )
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [
        range.from,
        range.to,
        customerSearch,
        customerPattern,
        customerPattern,
        customerPattern,
      ],
    ),
    all<Order>(
      "SELECT * FROM orders WHERE payment_status != 'verified' ORDER BY created_at DESC LIMIT 100",
    ),
    all<Customer>("SELECT * FROM customers WHERE status != 'inactive' ORDER BY full_name LIMIT 500"),
    all<PaymentApprovalRow>(
      `SELECT pea.*, au.email AS requester_email, c.full_name AS customer_name, o.order_number
       FROM payment_edit_approvals pea
       JOIN admin_users au ON au.id = pea.requested_by_admin_id
       JOIN payments p ON p.id = pea.payment_id
       LEFT JOIN customers c ON c.id = p.customer_id
       LEFT JOIN orders o ON o.id = p.order_id
       WHERE pea.status = 'pending'
       ORDER BY pea.created_at DESC
       LIMIT 50`,
    ),
  ]);

  return (
    <AdminShell title="Payments">
      {params.saved === "recorded" ? (
        <p className="admin-flash">Payment recorded successfully.</p>
      ) : null}
      {params.deleted === "1" ? (
        <p className="admin-flash">Payment deleted successfully.</p>
      ) : null}
      {params.updated === "1" ? (
        <p className="admin-flash">Payment updated successfully.</p>
      ) : null}
      {params.approval_requested === "1" ? (
        <p className="admin-flash">Payment edit sent for second-admin approval.</p>
      ) : null}
      {params.approved === "1" ? (
        <p className="admin-flash">Payment edit approved and applied.</p>
      ) : null}
      {params.rejected === "1" ? (
        <p className="admin-flash">Payment edit rejected.</p>
      ) : null}
      <DateRangeFilter basePath="/admin/payments" from={range.from} to={range.to} label="Payment date range" />
      <form method="get" action="/admin/payments" className="payment-customer-search">
        <input type="hidden" name="from" value={range.from} />
        <input type="hidden" name="to" value={range.to} />
        <label>
          Search payments by customer
          <input
            name="q"
            type="search"
            defaultValue={customerSearch}
            placeholder="Name, phone, or email"
          />
        </label>
        <button type="submit">Search</button>
        {customerSearch ? (
          <a href={`/admin/payments?from=${range.from}&to=${range.to}`}>Clear</a>
        ) : null}
      </form>
      <AdminPaymentForm orders={orders} customers={customers} paymentDate={range.to} />

      {approvals.length > 0 ? (
        <section className="admin-section-block">
          <h3>Pending payment edit approvals</h3>
          <p className="admin-note">A different admin must approve these edits before they change payment records.</p>
          <DataTable
            headers={["Requested", "Payment", "Requested by", "Change", "Approve"]}
            rows={approvals.map((approval) => {
              const payload = JSON.parse(approval.requested_payload) as {
                paymentDate: string;
                paymentMethod: string;
                paymentStatus: string;
                receivedAmountCents: number;
              };
              return [
                approval.created_at,
                approval.order_number ?? approval.customer_name ?? `Payment ${approval.payment_id}`,
                approval.requester_email,
                `${payload.paymentDate} ${payload.paymentMethod} ${payload.paymentStatus} ${formatMoney(payload.receivedAmountCents)}`,
                <div className="table-actions" key={approval.id}>
                  <form action={approvePaymentEdit} className="inline-form">
                    <input type="hidden" name="approval_id" value={approval.id} />
                    <input type="hidden" name="from" value={range.from} />
                    <input type="hidden" name="to" value={range.to} />
                    <input type="hidden" name="q" value={customerSearch} />
                    <button type="submit">Approve</button>
                  </form>
                  <form action={rejectPaymentEdit} className="inline-form">
                    <input type="hidden" name="approval_id" value={approval.id} />
                    <input type="hidden" name="from" value={range.from} />
                    <input type="hidden" name="to" value={range.to} />
                    <input type="hidden" name="q" value={customerSearch} />
                    <input name="review_notes" placeholder="Reason" />
                    <button type="submit" className="danger-button">Reject</button>
                  </form>
                </div>,
              ];
            })}
          />
        </section>
      ) : null}

      <DataTable
        headers={["Payment date", "Order", "Customer", "Method", "Status", "Expected", "Received", "Ref", "Notes", "Action"]}
        rows={rows.map((payment) => [
          payment.payment_date,
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
          <div className="table-actions" key={payment.id}>
            <EditPaymentForm
              payment={payment}
              from={range.from}
              to={range.to}
              query={customerSearch}
            />
            <DeletePaymentButton
              paymentId={payment.id}
              customerName={payment.customer_name ?? "this customer"}
              paymentDate={payment.payment_date}
              from={range.from}
              to={range.to}
            />
          </div>,
        ])}
      />
    </AdminShell>
  );
}
