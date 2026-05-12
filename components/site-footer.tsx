"use client";

import { usePathname } from "next/navigation";

// Pagine sempre-dark (Matrix theme) dove footer deve fondersi col nero.
const FORCED_DARK_PATHS = ["/mercato-libero/ticker"];

export function SiteFooter() {
  const pathname = usePathname() ?? "";
  const isDarkPage = FORCED_DARK_PATHS.some((p) => pathname.endsWith(p));

  if (isDarkPage) {
    return (
      <footer className="border-t border-emerald-400/20 bg-black">
        <div className="container mx-auto px-4 py-6 text-xs text-emerald-300/50 font-mono space-y-1">
          <p>
            Fonte: GME (Gestore dei Mercati Energetici) · ARERA (Portale Offerte).
            Dati riprodotti per uso informativo.
          </p>
          <p>© 2026 Energy Index</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t mt-16">
      <div className="container mx-auto px-4 py-8 text-sm text-muted-foreground space-y-2">
        <p>
          Fonte: GME — Gestore dei Mercati Energetici. Dati riprodotti per uso
          informativo.
        </p>
        <p>© 2026 Energy Index</p>
      </div>
    </footer>
  );
}
