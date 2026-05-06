import { ArrowRight, Zap } from "lucide-react";

export function CtaToEnergiapro({ campaign }: { campaign: string }) {
  const url = `https://energiapro.biz/?utm_source=energy-index&utm_medium=cta&utm_campaign=${encodeURIComponent(campaign)}`;
  return (
    <section
      aria-label="Confronta offerte"
      className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 sm:p-10"
    >
      {/* Decorative background blob */}
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
              Risparmia in bolletta
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Trova la tariffa migliore per te
          </h3>
          <p className="text-base text-muted-foreground max-w-md">
            Confronta tutte le offerte luce e gas del mercato libero in pochi
            secondi. Gratis e senza impegno.
          </p>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-7 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Vai al comparatore
          <ArrowRight
            className="h-5 w-5 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </a>
      </div>
    </section>
  );
}
