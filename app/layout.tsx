import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";
import { organization, website, jsonLdString } from "@/lib/seo/jsonld";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://energyindex.it"),
  title: { default: "Energy Index", template: "%s | Energy Index" },
  description:
    "Osservatorio prezzi luce e gas in tempo reale: PUN e PSV aggiornati ogni giorno con grafici storici e prezzi zonali.",
  openGraph: {
    siteName: "Energy Index",
    locale: "it_IT",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={inter.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(organization()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(website()) }}
        />
        {children}
        {/* Umami analytics — privacy-first, GDPR-friendly (no cookies),
            free tier 100k events/mese. Sostituisce Plausible. Dashboard:
            https://cloud.umami.is */}
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="e5cfcd7e-d356-4fd9-aef3-ba28d492292e"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
