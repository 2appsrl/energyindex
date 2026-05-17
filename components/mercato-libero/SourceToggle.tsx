"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

export function SourceToggle({ active }: { active: "placet" | "libero" }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Sorgente:</span>
      <div className="inline-flex items-center p-1 bg-muted rounded-full">
        <Link
          href="/it/mercato-libero?src=placet"
          onClick={() =>
            trackEvent("mercato_libero_source_toggle", { source: "placet" })
          }
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            active === "placet"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          PLACET ARERA
        </Link>
        <Link
          href="/it/mercato-libero?src=libero"
          onClick={() =>
            trackEvent("mercato_libero_source_toggle", { source: "libero" })
          }
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            active === "libero"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Mercato libero
          <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
            beta
          </span>
        </Link>
      </div>
    </div>
  );
}
