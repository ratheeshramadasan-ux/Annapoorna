import type { Metadata } from "next";
import SiteTheme from "@/components/SiteTheme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Annapoorna",
  description: "Homemade fresh tiffin service in Calgary NW.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteTheme />
        {children}
      </body>
    </html>
  );
}
