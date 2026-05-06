import { Zap } from "lucide-react";

export function CtaToEnergiapro({ campaign }: { campaign: string }) {
  const url = `https://energiapro.biz/?utm_source=energy-index&utm_medium=cta&utm_campaign=${encodeURIComponent(campaign)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      aria-label="Vai al comparatore EnergiaPro"
      className="group relative block cursor-pointer overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 sm:p-10 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
            Confronta le offerte luce e gas del mercato libero in pochi
            secondi. Gratis e senza impegno.
          </p>
          <p className="pt-1 text-xs text-muted-foreground/80">
            Powered by{" "}
            <span className="font-semibold text-primary">EnergiaPro</span>
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-primary/40">
          Vai al comparatore
        </span>
      </div>
    </a>
  );
}
