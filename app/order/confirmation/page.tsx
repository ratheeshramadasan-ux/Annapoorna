import Link from "next/link";
import PublicShell from "@/components/PublicShell";
import { formatMoney, formatPickupDate, getOrderByNumber } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; number?: string }>;
}) {
  const { order: orderNumber, number } = await searchParams;
  const data =
    (orderNumber ? await getOrderByNumber(orderNumber) : null) ??
    (number ? await getOrderByNumber(number) : null);

  return (
    <PublicShell active="order" title="Order Confirmation">
      {!data ? (
        <div className="empty-state">
          <h3>Order not found</h3>
          <p>Please check your confirmation link or track your order.</p>
          <Link className="gold-button" href="/track-order">
            Track Order
          </Link>
        </div>
      ) : (
        <section className="confirmation-card">
          <div className="confirmation-head">
            <p>Order number</p>
            <h3>{data.order.order_number}</h3>
            <span>{data.order.customer_facing_status}</span>
          </div>
          <div className="detail-grid">
            <div>
              <strong>Customer</strong>
              <p>{data.order.customer_name}</p>
              <p>{data.order.customer_email || "No email provided"}</p>
              <p>{data.order.customer_phone}</p>
            </div>
            <div>
              <strong>Pickup</strong>
              <p>{formatPickupDate(data.order.pickup_date)}</p>
              <p>{data.order.pickup_time}</p>
            </div>
          </div>
          <div className="line-list">
            {data.items.map((item) => (
              <div key={item.id}>
                <span>
                  {item.quantity} x {item.item_name_snapshot}
                </span>
                <strong>{formatMoney(item.line_total_cents)}</strong>
              </div>
            ))}
          </div>
          <div className="order-total">
            <span>Total</span>
            <strong>{formatMoney(data.order.total_cents)}</strong>
          </div>
          <p className="notice">
            Your order is pending manual approval. Annapoorna will confirm
            availability and payment instructions before pickup.
          </p>
        </section>
      )}
    </PublicShell>
  );
}
