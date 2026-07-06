import Image from "next/image";
import Link from "next/link";

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

export default function PublicShell({
  active,
  title,
  eyebrow,
  children,
}: PublicShellProps) {
  return (
    <main className="home-shell">
      <section className="top-banner compact-banner">
        <div className="banner-text">
          <h1>Annapoorna</h1>
          <p>Homemade Fresh Tiffin Service</p>
        </div>
        <div className="banner-logo">
          <Image
            src="/assets/brand-mark.jpg"
            alt="Annapoorna logo"
            width={120}
            height={120}
            priority
          />
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
