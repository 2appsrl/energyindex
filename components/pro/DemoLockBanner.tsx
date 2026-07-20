"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Banner amber riusabile in cima alle view dei tool Marketing/Trading per
 * comunicare cosa e' lockato nel demo e indirizzare alla pre-iscrizione.
 * Pattern stabilito in Backtest e AlertApi (Trading), generalizzato qui.
 */
export function DemoLockBanner({
  icon: Icon,
  title,
  description,
  ctaHref = "/it/pro#early-access",
  ctaLabel = "Sblocca tutto",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-300/40 bg-amber-50/60 p-4 flex flex-wrap items-center gap-3 text-sm print:hidden">
      <Icon className="h-5 w-5 text-amber-700 shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-900">{title}</p>
        <p className="text-xs text-amber-800/80 mt-0.5">{description}</p>
      </div>
      <Link
        href={ctaHref}
        className="inline-flex items-center justify-center rounded-md bg-amber-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-amber-500 transition-colors whitespace-nowrap"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
