import Link from "next/link";
import { logoutAdmin } from "@/app/actions";
import { getSettings } from "@/lib/db";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/prep", label: "Prep Plan" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/holidays", label: "Holidays" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const settings = await getSettings().catch(() => ({} as Record<string, string>));
  const brandIcon = settings.brand_icon_url || "/assets/brand-mark.jpg";
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brandIcon} alt="Annapoorna logo" />
          <div>
            <h1>Annapoorna</h1>
            <span>Admin</span>
          </div>
        </div>
        <nav>
          {adminLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAdmin} className="admin-logout">
          <button type="submit">Sign out</button>
        </form>
      </aside>
      <section className="admin-main">
        <header className="admin-top-banner">
          <div>
            <p>Hidden owner workspace</p>
            <h2>{title}</h2>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brandIcon} alt="Annapoorna logo" />
        </header>
        {children}
      </section>
    </main>
  );
}
