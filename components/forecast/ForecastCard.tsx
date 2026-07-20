import Link from "next/link";
import type { DriverItem } from "./DriverAttribution";

export interface ForecastCardProps {
  assetSlug: string;
  assetName: string;
  unit: string;
  forecastDate: string;
  spotValue: number | null;
  value: number;
  valueLower: number;
  valueUpper: number;
  horizonDays: number;
  drivers: DriverItem[];
}

export function ForecastCard(p: ForecastCardProps) {
  const deltaPct = p.spotValue !== null && p.spotValue !== 0
    ? ((p.value - p.spotValue) / p.spotValue) * 100
    : null;
  const deltaSign = deltaPct === null ? "" : deltaPct >= 0 ? "▲" : "▼";
  const deltaColor = deltaPct === null
    ? "text-muted-foreground"
    : deltaPct >= 0 ? "text-rose-500" : "text-emerald-500";

  return (
    <article className="rounded-xl border bg-card p-6 space-y-4">
      <header>
        <h3 className="text-lg font-semibold">{p.assetName}</h3>
        <p className="text-xs text-muted-foreground">
          Previsione a {p.horizonDays} giorni — {p.forecastDate}
        </p>
      </header>

      <div className="space-y-1">
        <div className="text-3xl font-bold tabular-nums">
          {p.value.toFixed(2)} <span className="text-base font-normal text-muted-foreground">{p.unit}</span>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          Banda 5–95%: {p.valueLower.toFixed(2)} – {p.valueUpper.toFixed(2)} {p.unit}
        </div>
        {deltaPct !== null && (
          <div className={`text-sm font-medium tabular-nums ${deltaColor}`}>
            {deltaSign} {Math.abs(deltaPct).toFixed(1)}% vs spot
          </div>
        )}
      </div>

      {p.drivers.length > 0 && (
        <ul className="space-y-1 text-xs">
          {p.drivers.slice(0, 3).map((d) => (
            <li key={d.name} className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">
                {d.direction === "up" ? "▲" : "▼"} {d.label}
              </span>
              <span className="tabular-nums">
                {d.direction === "up" ? "+" : "−"}{Math.abs(d.contribution).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`/it/indice/${p.assetSlug}#forecast`}
        className="inline-block text-sm font-medium text-primary hover:underline"
      >
        Vedi dettaglio →
      </Link>
    </article>
  );
}
