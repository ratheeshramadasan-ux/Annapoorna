import { loginAdmin } from "@/app/actions";
import AdminShell from "@/components/AdminShell";
import PasswordField from "@/components/PasswordField";
import { getAdminSession } from "@/lib/auth";
import { all, formatMoney } from "@/lib/db";

export const dynamic = "force-dynamic";

type Metric = { value: number };

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const admin = await getAdminSession();
  const params = await searchParams;
  if (!admin) {
    return (
      <main className="admin-login-shell">
        <form action={loginAdmin} className="form-panel admin-login-card">
          <h1>Annapoorna Admin</h1>
          <p>Owner access is available only from this hidden route.</p>
          {params.error === "missing-passcode" ? (
            <p className="form-error">
              Set ANNAPOORNA_ADMIN_PASSCODE before admin login can be used.
            </p>
          ) : null}
          {params.error === "invalid" ? (
            <p className="form-error">Invalid owner email or passcode.</p>
          ) : null}
          <label>
            Owner email
            <input name="email" type="email" required />
          </label>
          <label>
            Admin password
            <PasswordField name="passcode" required />
          </label>
          <button className="gold-button" type="submit">
            Open Admin
          </button>
        </form>
      </main>
    );
  }

  const [pending, pickups, amountReceived, expenses, menu, customers] = await Promise.all([
    all<Metric>("SELECT COUNT(*) AS value FROM orders WHERE status LIKE 'pending%'"),
    all<Metric>(
      "SELECT COUNT(*) AS value FROM orders WHERE pickup_date = date('now')",
    ),
    all<Metric>(
      "SELECT COALESCE(SUM(received_amount_cents), 0) AS value FROM payments WHERE payment_status IN ('partial', 'paid', 'verified')",
    ),
    all<Metric>("SELECT COALESCE(SUM(amount_cents), 0) AS value FROM expenses"),
    all<Metric>(
      "SELECT COUNT(*) AS value FROM menu_items WHERE is_active = 1 AND is_public = 1",
    ),
    all<Metric>("SELECT COUNT(*) AS value FROM customers"),
  ]);
  const receivedCents = amountReceived[0]?.value ?? 0;
  const expenseCents = expenses[0]?.value ?? 0;

  const cards = [
    { label: "Pending orders", value: pending[0]?.value ?? 0 },
    { label: "Today pickups", value: pickups[0]?.value ?? 0 },
    { label: "Total amount received", value: formatMoney(receivedCents) },
    { label: "Total expense", value: formatMoney(expenseCents) },
    { label: "Revenue", value: formatMoney(receivedCents - expenseCents) },
    { label: "Public menu items", value: menu[0]?.value ?? 0 },
    { label: "Customers", value: customers[0]?.value ?? 0 },
  ];

  return (
    <AdminShell title="Dashboard">
      <section className="admin-cards">
        {cards.map((card) => (
          <article key={card.label} className="admin-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>
      <p className="admin-note">Signed in as {admin.email}.</p>
    </AdminShell>
  );
}
