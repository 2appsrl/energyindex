import { Card } from "@/components/ui/card";
import {
  formatEurMwh,
  formatPercentDelta,
  formatRelativeTime,
  formatRetailEquivalent,
  type Commodity,
} from "@/lib/format";

export interface LatestValueProps {
  value: number;
  unit: string;
  observed_at: string;
  prev_value?: number;
  display_name: string;
  /** Se specificato, mostra la conversione retail sotto il big number. */
  commodity?: Commodity;
}

export function LatestValueCard({
  value,
  unit,
  observed_at,
  prev_value,
  display_name,
  commodity,
}: LatestValueProps) {
  const delta =
    prev_value !== undefined ? formatPercentDelta(value, prev_value) : null;
  const isUp = prev_value !== undefined && value >= prev_value;
  const retail =
    commodity && unit === "€/MWh"
      ? formatRetailEquivalent(value, commodity)
      : null;

  return (
    <Card className="p-6 flex flex-col gap-2">
      <div className="text-sm text-muted-foreground">{display_name}</div>
      <div className="text-4xl font-bold tabular-nums">
        {unit === "€/MWh"
          ? formatEurMwh(value)
          : `${value.toFixed(2)} ${unit}`}
      </div>
      {retail && (
        <div className="text-sm tabular-nums text-muted-foreground">
          ≈ {retail}
        </div>
      )}
      {delta && (
        <div
          className={`text-sm tabular-nums ${
            isUp ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          {delta}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        Aggiornato {formatRelativeTime(observed_at)}
      </div>
    </Card>
  );
}
