import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercentDelta } from "@/lib/format";

const itNumber = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const itSigned = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

export interface DriverCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  value: number | null;
  prevValue?: number | null;
  unit: string;
  /** Se passato, sostituisce il delta % con un'anomalia signed in unita' base
   *  (es. 2.3 -> "+2,3 °C"). */
  anomaly?: number | null;
  /** Label esplicativa sotto l'anomalia, es. "vs media 2021-2025". */
  baselineLabel?: string;
}

export function DriverCard({
  href,
  icon: Icon,
  title,
  subtitle,
  value,
  prevValue,
  unit,
  anomaly,
  baselineLabel,
}: DriverCardProps) {
  const usingAnomaly = anomaly !== undefined && anomaly !== null;
  const deltaPct =
    !usingAnomaly && value !== null && prevValue !== null && prevValue !== undefined
      ? formatPercentDelta(value, prevValue)
      : null;
  const isUp = usingAnomaly
    ? anomaly! >= 0
    : value !== null && prevValue !== null && prevValue !== undefined && value >= prevValue;

  return (
    <Link
      href={href}
      className="group relative block cursor-pointer overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {(deltaPct || usingAnomaly) && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
              isUp ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
            )}
          >
            {usingAnomaly ? `${itSigned.format(anomaly!)} ${unit}` : deltaPct}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-0.5">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="mt-2">
        {value !== null ? (
          <div className="text-2xl sm:text-3xl font-bold tabular-nums">
            {itNumber.format(value)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Dati in arrivo</div>
        )}
        {usingAnomaly && baselineLabel && (
          <div className="text-xs text-muted-foreground mt-0.5">{baselineLabel}</div>
        )}
      </div>
    </Link>
  );
}
