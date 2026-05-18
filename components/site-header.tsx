"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

// Pagine sempre-dark (Matrix theme) dove header deve fondersi col nero
// e il toggle theme non ha senso.
const FORCED_DARK_PATHS = ["/mercato-libero/ticker"];

// Rotte che usano un header dedicato brandizzato EIDX Pro: il global
// SiteHeader e' soppresso per evitare doppia barra in cima.
const HIDE_HEADER_PATHS = ["/pro/simulator"];

export function SiteHeader() {
  const pathname = usePathname() ?? "";

  if (HIDE_HEADER_PATHS.some((p) => pathname.endsWith(p) || pathname.includes(`${p}/`))) {
    return null;
  }

  const isDarkPage = FORCED_DARK_PATHS.some((p) => pathname.endsWith(p));

  if (isDarkPage) {
    return (
      <header className="border-b border-emerald-400/20 bg-black">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link
            href="/it"
            className="font-mono font-bold tabular-nums tracking-widest text-emerald-300 hover:text-emerald-400 transition-colors"
          >
            ENERGY INDEX
          </Link>
        </div>
      </header>
    );
  }

  // Su /it/pro il link "EIDX Pro" e' superfluo (utente gia' li').
  const isProSection = pathname.includes("/pro");

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between gap-2 px-4">
        <Link
          href="/it"
          aria-label="Energy Index — home"
          className="inline-flex items-center"
        >
          {/* Brand badge: variante chiara per light theme, variante scura per dark theme. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/energy-index-compact.svg"
            alt="Energy Index"
            width={164}
            height={36}
            className="h-9 w-auto dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/energy-index-compact-darkmode.svg"
            alt="Energy Index"
            width={164}
            height={36}
            className="hidden h-9 w-auto dark:block"
          />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {!isProSection && (
            <Link
              href="/it/pro"
              className="group inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300 transition-colors"
            >
              <span aria-hidden className="hidden sm:inline">⚡</span>
              <span>EIDX Pro</span>
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
