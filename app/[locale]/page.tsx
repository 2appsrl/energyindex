import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";

export default function HomeIt() {
  return (
    <div className="container mx-auto py-16 px-4 space-y-10">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">Energy Index</h1>
        <p className="text-muted-foreground text-lg">
          Osservatorio prezzi luce e gas in tempo reale.
        </p>
      </header>

      <Link
        href="/it/indice/pun"
        aria-label="Apri l'analisi prezzi dell'energia elettrica"
        className="group relative block cursor-pointer overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 sm:p-10 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Zap className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                Energia elettrica
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Analisi prezzi Energia Elettrica
            </h2>
            <p className="text-base text-muted-foreground max-w-md">
              Prezzo Unico Nazionale (PUN) day-ahead, aggiornato dal GME.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-primary/30">
            Vedi il grafico
            <ArrowRight
              className="h-5 w-5 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </div>
  );
}
