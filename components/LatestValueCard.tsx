import { Card } from "@/components/ui/card";
import {
  formatEurMwh,
  formatPercentDelta,
  formatRelativeTime,
  formatRetailEquivalent,
  type Commodity,
} from "@/lib/format";

const itSigned = new Intl.NumberFormat("it-IT", {
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
  /** Se passato, sostituisce il delta % con un'anomalia signed in unita' base
   *  (es. 2.3 -> "+2,3 °C"). Utile per la temperatura vs media stagionale. */
  anomaly?: number;
  /** Label esplicativa mostrata sotto l'anomalia, es. "vs media 2021-2025". */
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
  const usingAnomaly = anomaly !== undefined;
  const delta =
    !usingAnomaly && prev_value !== undefined
      ? formatPercentDelta(value, prev_value)
      : null;
  const isUp = usingAnomaly
    ? anomaly! >= 0
    : prev_value !== undefined && value >= prev_value;
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
      {usingAnomaly ? (
        <div className="space-y-0.5">
          <div
            className={`text-sm tabular-nums ${
              isUp ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {itSigned.format(anomaly!)} {unit}
          </div>
          {baselineLabel && (
            <div className="text-xs text-muted-foreground">{baselineLabel}</div>
          )}
        </div>
      ) : (
        delta && (
          <div
            className={`text-sm tabular-nums ${
              isUp ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {delta}
          </div>
        )
      )}
      <div className="text-xs text-muted-foreground">
        Aggiornato {formatRelativeTime(observed_at)}
      </div>
    </Card>
  );
}
