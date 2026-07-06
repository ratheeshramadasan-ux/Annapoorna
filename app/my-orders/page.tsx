import Link from "next/link";
import { logoutCustomer, requestPickupDateChange } from "@/app/actions";
import PublicShell from "@/components/PublicShell";
import { getCustomerSession } from "@/lib/auth";
import { formatMoney, formatPickupDate, getCustomerOrderHistory } from "@/lib/db";

export const dynamic = "force-dynamic";

function futureWeekdays(startDate: string, durationDays: number) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const cutoff = tomorrow.toISOString().slice(0, 10);
  return Array.from({ length: durationDays }, (_, index) => {
    const date = new Date(`${startDate}T12:00:00`);
    date.setDate(date.getDate() + index);
    return date;
  })
    .filter((date) => {
      const value = date.toISOString().slice(0, 10);
      const day = date.getDay();
      return value > cutoff && day >= 1 && day <= 5;
    })
    .map((date) => date.toISOString().slice(0, 10));
}

export default async function MyOrdersPage() {
  const customer = await getCustomerSession();
  const orders = customer ? await getCustomerOrderHistory(customer) : [];

  return (
    <PublicShell title="My Orders" active="track">
      {!customer ? (
        <div className="empty-state">
          <h3>Sign in to view orders</h3>
          <p>
            Your history includes orders linked by customer account, email, or
            phone.
          </p>
          <Link className="gold-button" href="/account/login">
            Customer Login
          </Link>
        </div>
      ) : (
        <section className="confirmation-card">
          <div className="confirmation-head">
            <div>
              <p>Customer orders</p>
              <h3>{customer.full_name}</h3>
              <span>{orders.length} orders</span>
            </div>
            <form action={logoutCustomer}>
              <button className="outline-dark-button" type="submit">
                Sign Out
              </button>
            </form>
          </div>
          <div className="line-list">
            {orders.length === 0 ? (
              <p>No linked orders yet.</p>
            ) : (
              orders.map((order) => (
                <article key={order.id} className="my-order-card">
                  <div>
                    <span>
                      {order.order_number} - {formatPickupDate(order.pickup_date)} -{" "}
                      {order.customer_facing_status}
                    </span>
                    <strong>{formatMoney(order.total_cents)}</strong>
                  </div>
                  {(order.order_type === "weekly" || order.order_type === "monthly") ? (
                    <form action={requestPickupDateChange} className="pickup-change-form">
                      <input type="hidden" name="order_id" value={order.id} />
                      <p>
                        Manage pickup dates. Changes must be requested at least
                        one day before pickup.
                      </p>
                      <div className="day-selector">
                        {futureWeekdays(
                          order.selected_start_date ?? order.pickup_date,
                          order.order_type === "weekly" ? 14 : 40,
                        ).map((dateValue) => (
                          <label key={dateValue} className="checkbox-line">
                            <input
                              name="selected_days"
                              type="checkbox"
                              value={dateValue}
                              defaultChecked={order.selected_days?.split(",").includes(dateValue)}
                            />
                            {formatPickupDate(dateValue)}
                          </label>
                        ))}
                      </div>
                      <label>
                        Notes
                        <input name="notes" placeholder="Optional change note" />
                      </label>
                      <button className="outline-dark-button" type="submit">
                        Request Date Change
                      </button>
                    </form>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
