import { cn } from "@/lib/utils";

export interface AggregateCardProps {
  title: string;
  median: number | null;
  p25: number | null;
  p75: number | null;
  sampleSize: number;
  unit: string;
  /** Spread vs wholesale reference, percent. Optional. */
  spreadPct?: number | null;
}

export function AggregateCard({
  title,
  median,
  p25,
  p75,
  sampleSize,
  unit,
  spreadPct,
}: AggregateCardProps) {
  const noData = median === null || sampleSize === 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-muted-foreground">
          {title}
        </h3>
        {noData ? (
          <p className="text-base text-muted-foreground">Dati in arrivo</p>
        ) : (
          <>
            <p className="text-3xl sm:text-4xl font-bold tabular-nums">
              {median!.toFixed(4)}{" "}
              <span className="text-base font-normal text-muted-foreground">
                {unit}
              </span>
            </p>
            {spreadPct !== undefined && spreadPct !== null && (
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  spreadPct >= 0 ? "text-rose-400" : "text-emerald-400",
                )}
              >
                {spreadPct >= 0 ? "+" : ""}
                {spreadPct.toFixed(1)}% vs wholesale
              </p>
            )}
            <div className="text-xs text-muted-foreground tabular-nums">
              p25 {p25?.toFixed(4) ?? "—"} · p75 {p75?.toFixed(4) ?? "—"} ·{" "}
              {sampleSize} offerte
            </div>
          </>
        )}
      </div>
    </div>
  );
}
