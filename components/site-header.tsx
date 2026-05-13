"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

// Pagine sempre-dark (Matrix theme) dove header deve fondersi col nero
// e il toggle theme non ha senso.
const FORCED_DARK_PATHS = ["/mercato-libero/ticker"];

export function SiteHeader() {
  const pathname = usePathname() ?? "";
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

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
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
        <ThemeToggle />
      </div>
    </header>
  );
}
