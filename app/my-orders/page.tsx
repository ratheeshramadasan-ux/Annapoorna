import Link from "next/link";
import { logoutCustomer } from "@/app/actions";
import PublicShell from "@/components/PublicShell";
import { getCustomerSession } from "@/lib/auth";
import { formatMoney, formatPickupDate, getCustomerOrderHistory } from "@/lib/db";

export const dynamic = "force-dynamic";

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
                <div key={order.id}>
                  <span>
                    {order.order_number} - {formatPickupDate(order.pickup_date)} -{" "}
                    {order.customer_facing_status}
                  </span>
                  <strong>{formatMoney(order.total_cents)}</strong>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
