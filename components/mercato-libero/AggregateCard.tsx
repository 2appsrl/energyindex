export interface AggregateCardProps {
  title: string;
  median: number | null;
  p25: number | null;
  p75: number | null;
  sampleSize: number;
  unit: string;
  /**
   * Se true, il valore mostrato e' uno SPREAD additivo sull'indice wholesale
   * di riferimento (PUN o PSV), non un prezzo finale. La UI prepende "+"
   * e mostra una nota esplicativa.
   */
  isSpread?: boolean;
  /**
   * Nome dell'indice wholesale di riferimento (es. "PUN" o "PSV"). Usato
   * solo quando isSpread=true per il testo "+ X €/kWh sopra <reference>".
   */
  referenceLabel?: string;
}

export function AggregateCard({
  title,
  median,
  p25,
  p75,
  sampleSize,
  unit,
  isSpread = false,
  referenceLabel,
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
              {isSpread ? "+" : ""}
              {median!.toFixed(4)}{" "}
              <span className="text-base font-normal text-muted-foreground">
                {unit}
              </span>
            </p>
            {isSpread && referenceLabel && (
              <p className="text-sm text-muted-foreground">
                Spread mediano sopra il {referenceLabel} all&apos;ingrosso.
                Bolletta = {referenceLabel} + spread.
              </p>
            )}
            <div className="text-xs text-muted-foreground tabular-nums">
              p25 {isSpread ? "+" : ""}
              {p25?.toFixed(4) ?? "—"} · p75 {isSpread ? "+" : ""}
              {p75?.toFixed(4) ?? "—"} · {sampleSize} offerte domestico
            </div>
          </>
        )}
      </div>
    </div>
  );
}
