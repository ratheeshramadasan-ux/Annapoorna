import Link from "next/link";
import { getSettings } from "@/lib/db";

type PublicShellProps = {
  active?: "home" | "order" | "reviews" | "track";
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
};

const nav = [
  { href: "/", label: "Home", key: "home" },
  { href: "/order", label: "Order Food", key: "order" },
  { href: "/reviews", label: "Reviews", key: "reviews" },
  { href: "/track-order", label: "Track Order / My Orders", key: "track" },
] as const;

export function PublicNav({ active }: { active?: PublicShellProps["active"] }) {
  return (
    <nav className="main-nav">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={active === item.key ? "active" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function PublicShell({
  active,
  title,
  eyebrow,
  children,
}: PublicShellProps) {
  const settings = await getSettings().catch(() => ({} as Record<string, string>));
  const brandIcon = settings.brand_icon_url || "/assets/brand-mark.jpg";
  return (
    <main className="home-shell">
      <section className="top-banner compact-banner">
        <div className="banner-text">
          <h1>Annapoorna</h1>
          <p>Homemade Fresh Tiffin Service</p>
        </div>
        <div className="banner-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brandIcon} alt="Annapoorna logo" />
        </div>
      </section>
      <PublicNav active={active} />
      {title ? (
        <header className="page-heading">
          {eyebrow ? <p>{eyebrow}</p> : null}
          <h2>{title}</h2>
        </header>
      ) : null}
      {children}
    </main>
  );
}
