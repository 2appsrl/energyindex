const NUMBER_4DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const NUMBER_2DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmt(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "—" : NUMBER_4DP.format(n);
}

function fmt2(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "—" : NUMBER_2DP.format(n);
}

export interface AggregateCardProps {
  title: string;
  median: number | null;
  p25: number | null;
  p75: number | null;
  min?: number | null;
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
  /**
   * Mediana / quartili del costo commercializzazione fisso mensile
   * (EUR/mese). Renderizzato solo per source='libero' (PLACET non lo
   * espone). null o 0 -> niente riga.
   */
  fixedCostMedian?: number | null;
  fixedCostP25?: number | null;
  fixedCostP75?: number | null;
}

export function AggregateCard({
  title,
  median,
  p25,
  p75,
  min,
  sampleSize,
  unit,
  isSpread = false,
  referenceLabel,
  fixedCostMedian = null,
  fixedCostP25 = null,
  fixedCostP75 = null,
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
              {fmt(median)}{" "}
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
            {!isSpread && min != null && Number.isFinite(min) && (
              <p className="text-sm text-emerald-400 tabular-nums">
                Migliore offerta: {fmt(min)} {unit}
              </p>
            )}
            <div className="text-xs text-muted-foreground tabular-nums">
              p25 {isSpread ? "+" : ""}{fmt(p25)} · p75 {isSpread ? "+" : ""}{fmt(p75)} · {sampleSize} offerte domestico
            </div>
            {fixedCostMedian != null && Number.isFinite(fixedCostMedian) && fixedCostMedian > 0 && (
              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50 tabular-nums">
                + {fmt2(fixedCostMedian)} €/mese fisso (mediano
                {fixedCostP25 != null && fixedCostP75 != null &&
                  ` · range ${fmt2(fixedCostP25)}–${fmt2(fixedCostP75)}`}
                )
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
