import Link from "next/link";
import { logoutAdmin } from "@/app/actions";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <h1>Annapoorna Admin</h1>
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
        <header>
          <p>Hidden owner workspace</p>
          <h2>{title}</h2>
        </header>
        {children}
      </section>
    </main>
  );
}
