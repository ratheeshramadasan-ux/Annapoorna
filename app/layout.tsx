import React from 'react';
import { usePathname } from 'next/navigation';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Annapoorna</title>
        <link rel="icon" href="/favicon.ico" />
        <style jsx global>{`
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
            color: #333;
          }
          .hero-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 2rem;
            background-color: #1a1a1a;
            border-bottom: 2px solid gold;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          .hero-section img {
            max-height: 300px;
            margin-left: 2rem;
          }
          .hero-section h1 {
            color: gold;
            font-size: 2.5rem;
            margin: 0;
          }
          .hero-section p {
            color: #fff;
            font-size: 1.2rem;
            margin: 0;
          }
          @media (max-width: 768px) {
            .hero-section img {
              max-height: 200px;
            }
            .hero-section h1 {
              font-size: 2rem;
            }
            .hero-section p {
              font-size: 1rem;
            }
          }
        `}</style>
      </head>
      <body>
        <Header />
        {pathname === '/' && (
          <div className="hero-section">
            <h1>Welcome to Annapoorna</h1>
            <p>Enjoy delicious meals with us!</p>
            <img src="/public/assets/brand-mark.jpg" alt="Brand Mark" />
          </div>
        )}
        {children}
        <Footer />
      </body>
    </html>
  );
}
