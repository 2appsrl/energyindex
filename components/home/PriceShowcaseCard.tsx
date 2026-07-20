import Link from "next/link";
import { Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatEurMwh,
  formatPercentDelta,
  formatRetailEquivalent,
  type Commodity,
} from "@/lib/format";

const ICONS = {
  zap: Zap,
  flame: Flame,
} as const;

export interface PriceShowcaseCardProps {
  href: string;
  icon: keyof typeof ICONS;
  title: string;
  value: number | null;
  prevValue: number | null;
  unit: string;
  ariaLabel: string;
  /** Se specificato, sotto il big number mostra anche la conversione retail
   *  (€/kWh per luce, €/Smc per gas). */
  commodity?: Commodity;
}

export function PriceShowcaseCard({
  href,
  icon,
  title,
  value,
  prevValue,
  unit,
  ariaLabel,
  commodity,
}: PriceShowcaseCardProps) {
  const Icon = ICONS[icon];
  const delta =
    value !== null && prevValue !== null
      ? formatPercentDelta(value, prevValue)
      : null;
  const isUp =
    value !== null && prevValue !== null && value >= prevValue;
  const retail =
    value !== null && commodity && unit === "€/MWh"
      ? formatRetailEquivalent(value, commodity)
      : null;

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group relative block h-56 sm:h-72 cursor-pointer overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
          </span>
          {delta && (
            <span
              className={cn(
                "rounded-full px-3 py-1 text-sm font-bold tabular-nums",
                isUp
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-rose-500/15 text-rose-400",
              )}
            >
              {delta}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {title}
          </h2>
          {value !== null ? (
            <>
              <p className="text-4xl sm:text-5xl font-bold tabular-nums">
                {unit === "€/MWh"
                  ? formatEurMwh(value)
                  : `${value.toFixed(2)} ${unit}`}
              </p>
              {retail && (
                <p className="text-sm sm:text-base tabular-nums text-muted-foreground">
                  ≈ {retail}
                </p>
              )}
            </>
          ) : (
            <p className="text-base sm:text-lg text-muted-foreground">
              Dati in arrivo
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
