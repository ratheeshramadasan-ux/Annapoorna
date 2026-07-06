import { updateOrderStatus } from "@/app/actions";
import AdminShell from "@/components/AdminShell";
import DataTable from "@/components/DataTable";
import DateRangeFilter from "@/components/DateRangeFilter";
import DeleteOrderButton from "@/components/DeleteOrderButton";
import OrderPaymentForm from "@/components/OrderPaymentForm";
import { requireAdminSession } from "@/lib/auth";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { all, formatMoney, formatPickupDate } from "@/lib/db";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

type AdminOrderRow = Order & {
  received_amount_cents: number | null;
  payment_method: string | null;
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams & { saved?: string }>;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const range = resolveDateRange(params);
  const rows = await all<AdminOrderRow>(
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
     WHERE o.pickup_date BETWEEN ? AND ?
     ORDER BY o.pickup_date DESC, o.created_at DESC
     LIMIT 200`,
    [range.from, range.to],
  );

  return (
    <AdminShell title="Orders">
      <DateRangeFilter basePath="/admin/orders" from={range.from} to={range.to} label="Pickup date range" />
      {params.saved === "status" ? (
        <p className="admin-flash">Order status updated successfully.</p>
      ) : null}
      {params.saved === "payment" ? (
        <p className="admin-flash">Payment details updated successfully.</p>
      ) : null}
      {params.saved === "deleted" ? (
        <p className="admin-flash">Order deleted successfully.</p>
      ) : null}
      <DataTable
        headers={["Order", "Customer", "Pickup", "Order status", "Payment", "Total", "Delete"]}
        rows={rows.map((order) => [
          order.order_number,
          `${order.customer_name} - ${order.customer_phone}`,
          `${formatPickupDate(order.pickup_date)} ${order.pickup_time}`,
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
