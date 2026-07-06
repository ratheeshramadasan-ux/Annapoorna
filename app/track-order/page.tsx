import { lookupOrder } from "@/app/actions";
import PublicShell from "@/components/PublicShell";
import {
  formatMoney,
  formatPickupDate,
  getOrderByNumber,
  getSettings,
  settingNumber,
} from "@/lib/db";

export const dynamic = "force-dynamic";

function canCancel(pickupDate: string, pickupTime: string, cutoffHours: number) {
  const pickup = new Date(`${pickupDate}T${pickupTime}:00`);
  return pickup.getTime() - Date.now() >= cutoffHours * 60 * 60 * 1000;
}

export default async function TrackOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; found?: string; error?: string }>;
}) {
  const params = await searchParams;
  const data =
    params.order && params.found === "1"
      ? await getOrderByNumber(params.order)
      : null;
  const settings = await getSettings();
  const cutoff = settingNumber(settings, "customer_cancel_cutoff_hours", 24);

  return (
    <PublicShell active="track" title="Track Order / My Orders">
      <section className="split-panel">
        <form action={lookupOrder} className="form-panel">
          <h3>Find an order</h3>
          {params.error ? (
            <p className="form-error">No order matched those details.</p>
          ) : null}
          <label>
            Order number
            <input name="order_number" defaultValue={params.order ?? ""} required />
          </label>
          <label>
            Email or phone
            <input name="email_or_phone" required />
          </label>
          <button className="gold-button" type="submit">
            Track Order
          </button>
        </form>

        <div className="form-panel soft-panel">
          <h3>Customer account</h3>
          <p>
            Registered customers can use My Orders after signing in with their
            email or phone.
          </p>
          <a className="outline-dark-button" href="/my-orders">
            My Orders
          </a>
        </div>
      </section>

      {data ? (
        <section className="confirmation-card">
          <div className="confirmation-head">
            <p>Status</p>
            <h3>{data.order.customer_facing_status}</h3>
            <span>Payment: {data.order.payment_status}</span>
          </div>
          <div className="detail-grid">
            <div>
              <strong>Pickup</strong>
              <p>{formatPickupDate(data.order.pickup_date)}</p>
              <p>{data.order.pickup_time}</p>
            </div>
            <div>
              <strong>Cancellation</strong>
              <p>
                {canCancel(data.order.pickup_date, data.order.pickup_time, cutoff)
                  ? `Eligible until ${cutoff} hours before pickup.`
                  : "Cutoff has passed. Please contact Annapoorna directly."}
              </p>
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
        </section>
      ) : null}
    </PublicShell>
  );
}
