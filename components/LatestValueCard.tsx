import { Card } from "@/components/ui/card";
import {
  formatEurMwh,
  formatPercentDelta,
  formatRelativeTime,
} from "@/lib/format";

export interface LatestValueProps {
  value: number;
  unit: string;
  observed_at: string;
  prev_value?: number;
  display_name: string;
}

export function LatestValueCard({
  value,
  unit,
  observed_at,
  prev_value,
  display_name,
}: LatestValueProps) {
  const delta =
    prev_value !== undefined ? formatPercentDelta(value, prev_value) : null;
  const isUp = prev_value !== undefined && value >= prev_value;

  return (
    <Card className="p-6 flex flex-col gap-2">
      <div className="text-sm text-muted-foreground">{display_name}</div>
      <div className="text-4xl font-bold tabular-nums">
        {unit === "€/MWh"
          ? formatEurMwh(value)
          : `${value.toFixed(2)} ${unit}`}
      </div>
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
