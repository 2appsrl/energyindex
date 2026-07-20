import { Card } from "@/components/ui/card";
import {
  formatEurMwh,
  formatPercentDelta,
  formatRelativeTime,
  formatRetailEquivalent,
  type Commodity,
} from "@/lib/format";

const itSignedC = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

export interface LatestValueProps {
  value: number;
  unit: string;
  observed_at: string;
  prev_value?: number;
  display_name: string;
  /** Se specificato, mostra la conversione retail sotto il big number. */
  commodity?: Commodity;
  /** Anomalia (es. temperatura): valore signed da mostrare con icona ▲/▼. */
  anomaly?: number | null;
  /** Etichetta sotto l'anomalia, es. "vs media 2021-2025". */
  baselineLabel?: string;
}

export function LatestValueCard({
  value,
  unit,
  observed_at,
  prev_value,
  display_name,
  commodity,
  anomaly,
  baselineLabel,
}: LatestValueProps) {
  const delta =
    prev_value !== undefined ? formatPercentDelta(value, prev_value) : null;
  const isUp = prev_value !== undefined && value >= prev_value;
  const retail =
    commodity && unit === "€/MWh"
      ? formatRetailEquivalent(value, commodity)
      : null;
  const hasAnomaly = anomaly !== null && anomaly !== undefined;

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
      {hasAnomaly && (
        <div className="flex flex-col gap-0.5">
          <div
            className={`text-sm tabular-nums font-semibold ${
              anomaly! >= 0 ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {itSignedC.format(anomaly!)} {unit}
          </div>
          {baselineLabel && (
            <div className="text-xs text-muted-foreground">{baselineLabel}</div>
          )}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        Aggiornato {formatRelativeTime(observed_at)}
      </div>
    </Card>
  );
}
