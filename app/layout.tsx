import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
