// app/page.tsx

import Image from "next/image";
import Link from "next/link";
import { PublicNav } from "@/components/PublicShell";
import { getHomeContent } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const homeContent = await getHomeContent();

  return (
    <main className="home-shell">
      <section className="top-banner">
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

      <PublicNav active="home" />

      <section className="hero-panel">
        <div className="hero-copy">
          <p className="hero-kicker">Homemade - Pickup Only - Calgary NW</p>

          <h2>
            Fresh homemade tiffin meals featuring authentic North Indian and
            South Indian comfort food, prepared daily with quality ingredients
            and traditional flavours.
          </h2>

          <div className="hero-actions">
            <Link href="/order" className="gold-button">
              Order Food
            </Link>

            <a
              href="https://wa.me/"
              className="outline-button"
              target="_blank"
              rel="noreferrer"
            >
              Message on WhatsApp
            </a>
          </div>
        </div>

        <div className="hero-image-wrap">
          <Image
            src="/assets/veg-thali.png"
            alt="Vegetarian thali meal"
            width={360}
            height={360}
            className="hero-food-image"
            priority
          />
        </div>
      </section>

      <section className="info-cards">
        <article className="info-card">
          <h3>Menu</h3>
          <ul>
            {homeContent.menu.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>

        <article className="info-card">
          <h3>Pickup Details</h3>
          {homeContent.pickup.map((line, index) => (
            <p key={line}>
              {index === 0 ? <strong>{line}</strong> : line}
            </p>
          ))}
        </article>

        <article className="info-card">
          <h3>Perfect For</h3>
          <ul>
            {homeContent.perfectFor.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="tag-strip">
        <span>Fresh</span>
        <span>Daily Menu</span>
        <span>Veg / Non-Veg</span>
        <span>Affordable</span>
        <span>Pickup Only</span>
        <span>Homemade Taste</span>
      </section>

      <footer className="home-footer">Annapoorna - Taste of Home</footer>
    </main>
  );
}
