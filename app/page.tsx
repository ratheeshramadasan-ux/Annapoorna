// app/page.tsx

import Image from "next/image";
import Link from "next/link";
import FloatingChatButton from "@/components/FloatingChatButton";
import { PublicNav } from "@/components/PublicShell";
import { getHomeContent, getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [homeContent, settings] = await Promise.all([getHomeContent(), getSettings().catch(() => ({} as Record<string, string>))]);
  const brandLogo = settings.brand_logo_url || settings.brand_icon_url || "/assets/brand-mark.jpg";
  const portalTitle = settings.brand_portal_title || "Annapoorna";
  const portalSubtitle = settings.brand_portal_subtitle || "Homemade Fresh Tiffin Service";
  const whatsappNumber = (settings.business_whatsapp_number || "14034814101").replace(/[^\d]/g, "");
  const chatMessage = encodeURIComponent(
    settings.customer_chat_welcome_message || "Hi Annapoorna, I have a question.",
  );

  return (
    <>
      <main className="home-shell">
        <section className="top-banner">
          <div className="banner-text">
            <h1>{portalTitle}</h1>
            <p>{portalSubtitle}</p>
          </div>

          <div className="banner-logo">
            <Image
              src={brandLogo}
              alt={`${portalTitle} logo`}
              width={120}
              height={120}
              unoptimized
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

            {whatsappNumber ? (
              <a
                href={`https://wa.me/${whatsappNumber}?text=${chatMessage}`}
                className="outline-button"
                target="_blank"
                rel="noreferrer"
              >
                Message on WhatsApp
              </a>
            ) : null}
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
        <details className="info-card collapsible-card" open>
          <summary>Menu</summary>
          <ul>
            {homeContent.menu.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>

        <details className="info-card collapsible-card" open>
          <summary>Pickup Details</summary>
          {homeContent.pickup.map((line, index) => (
            <p key={line}>
              {index === 0 ? <strong>{line}</strong> : line}
            </p>
          ))}
        </details>

        <details className="info-card collapsible-card" open>
          <summary>Perfect For</summary>
          <ul>
            {homeContent.perfectFor.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </section>

      <section className="tag-strip">
        <span>Fresh</span>
        <span>Daily Menu</span>
        <span>Veg / Non-Veg</span>
        <span>Affordable</span>
        <span>Pickup Only</span>
        <span>Homemade Taste</span>
      </section>

        <footer className="home-footer">{portalTitle} - Taste of Home</footer>
      </main>
      <FloatingChatButton settings={settings} />
    </>
  );
}
