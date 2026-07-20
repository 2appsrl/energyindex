"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pagine sempre-dark (Matrix theme) dove footer deve fondersi col nero.
const FORCED_DARK_PATHS = ["/mercato-libero/ticker"];

const CONTACT_EMAIL = "pro@energyindex.pro";

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
          <p>
            Contatti:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-emerald-300 hover:text-emerald-200 underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p>© 2026 Energy Index</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t mt-16 bg-card/50">
      <div className="container mx-auto px-4 py-10 space-y-8">
        {/* Top: 3 colonne */}
        <div className="grid gap-8 md:grid-cols-3">
          {/* Brand */}
          <div className="space-y-2">
            <p className="text-base font-bold tracking-tight text-foreground">
              Energy Index
            </p>
            <p className="text-sm text-muted-foreground">
              Osservatorio prezzi energy italiano. Forecast PUN/PSV/TTF + analytics
              professionali per fornitori, broker, trader e PMI energivore.
            </p>
          </div>

          {/* Contatti */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Contatti
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="block text-base font-mono font-semibold text-foreground hover:text-primary transition-colors"
            >
              {CONTACT_EMAIL}
            </a>
            <p className="text-xs text-muted-foreground">
              Demo, quote Enterprise, integrazioni custom, supporto tecnico — risposta
              entro 2 giorni lavorativi.
            </p>
            <Link
              href="/it/pro#contatti"
              className="inline-block text-xs font-semibold text-primary hover:underline"
            >
              Apri form contatti →
            </Link>
          </div>

          {/* Link rapidi */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Link rapidi
            </p>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/it/forecast" className="text-muted-foreground hover:text-foreground transition-colors">
                  Forecast pubblico
                </Link>
              </li>
              <li>
                <Link href="/it/mercato-libero" className="text-muted-foreground hover:text-foreground transition-colors">
                  Mercato libero
                </Link>
              </li>
              <li>
                <Link href="/it/pro" className="text-muted-foreground hover:text-foreground transition-colors">
                  EIDX Pro
                </Link>
              </li>
              <li>
                <Link href="/it/forecast/metodologia" className="text-muted-foreground hover:text-foreground transition-colors">
                  Metodologia forecast
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom: info legali */}
        <div className="border-t border-border/60 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
          <p>
            Fonte: GME — Gestore dei Mercati Energetici · ARERA. Dati riprodotti per uso
            informativo.
          </p>
          <p>© 2026 Energy Index</p>
        </div>
      </div>
    </footer>
  );
}
