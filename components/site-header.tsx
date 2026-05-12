"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

// Pagine sempre-dark dove il toggle theme non ha senso (es. Market Map).
const FORCED_DARK_PATHS = ["/mercato-libero/ticker"];

export function SiteHeader() {
  const pathname = usePathname() ?? "";
  const hideThemeToggle = FORCED_DARK_PATHS.some((p) => pathname.endsWith(p));

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/it" className="font-bold tabular-nums tracking-tight">
          Energy Index
        </Link>
        {!hideThemeToggle && <ThemeToggle />}
      </div>
    </header>
  );
}
