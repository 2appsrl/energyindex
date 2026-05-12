import Link from "next/link";
import { ArrowRight, LineChart } from "lucide-react";

export interface MarketBannerProps {
  /** Mediana luce variabile (alpha), null se nessun dato. */
  luceVariabileMedian: number | null;
  /** Numero totale offerte oggi (somma sample_size dei 4 slug). */
  totalOffers: number;
}

export function MarketBanner({ luceVariabileMedian, totalOffers }: MarketBannerProps) {
  const hasData = luceVariabileMedian !== null && totalOffers > 0;
  return (
    <Link
      href="/it/mercato-libero"
      aria-label="Esplora le offerte del mercato libero"
      className="group relative block cursor-pointer overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <LineChart className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Mercato Libero</h2>
            {hasData ? (
              <p className="text-sm sm:text-base text-muted-foreground">
                Spread mediano luce variabile:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  +{luceVariabileMedian!.toFixed(4)} €/kWh
                </span>{" "}
                · {totalOffers} offerte ARERA
              </p>
            ) : (
              <p className="text-sm sm:text-base text-muted-foreground">
                Esplora le offerte PLACET aggiornate ogni giorno
              </p>
            )}
          </div>
        </div>
        <ArrowRight
          aria-hidden="true"
          className="hidden sm:block h-6 w-6 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"
        />
      </div>
    </Link>
  );
}
