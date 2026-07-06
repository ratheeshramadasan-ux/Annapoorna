import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
