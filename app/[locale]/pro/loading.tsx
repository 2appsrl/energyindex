/**
 * Loading skeleton brandizzato per tutte le route /pro/*. Mostrato
 * istantaneamente da Next.js mentre il server component carica i dati
 * (force-dynamic + multiple RPC calls). Risolve il "click che sembra non
 * partire" su navigation a pagine pesanti.
 */
export default function ProLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      {/* Header placeholder che mimica EidxProHeader per continuita' visiva */}
      <header className="bg-[#0a3d2e] text-white border-b border-emerald-400/20">
        <div className="container mx-auto flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-3 text-sm font-semibold tracking-wide">
            <span className="text-emerald-300">EIDX</span>
            <span className="text-white/30" aria-hidden>
              |
            </span>
            <span className="text-white/60">Caricamento...</span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-white/40">
            <span className="text-emerald-300/60 font-semibold tracking-widest uppercase">
              Enterprise
            </span>
          </div>
        </div>
      </header>

      {/* Body skeleton */}
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          {/* Spinner brandizzato */}
          <div
            className="h-12 w-12 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin"
            aria-hidden
          />
          <p className="text-sm font-medium text-stone-700">Caricamento dati in tempo reale...</p>
          <p className="text-xs text-stone-500">
            Forecast, spark spread, posizioni, offerte mercato libero
          </p>
        </div>

        {/* Skeleton cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto pt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-stone-200 bg-white p-6 space-y-3 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-3 w-20 rounded bg-stone-200" />
              <div className="h-8 w-32 rounded bg-stone-300" />
              <div className="h-3 w-full rounded bg-stone-200" />
              <div className="h-3 w-3/4 rounded bg-stone-200" />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Caricamento in corso, attendi qualche secondo.</span>
    </div>
  );
}
