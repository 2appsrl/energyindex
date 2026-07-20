/**
 * Loading skeleton per /forecast/* — mostrato durante il fetch dei forecast
 * pubblici (PUN/PSV/TTF su 7/30/90/180 giorni + track record + metodologia).
 */
export default function ForecastLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="container mx-auto px-4 py-10">
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div
          className="h-12 w-12 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin"
          aria-hidden
        />
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
          Caricamento forecast in corso...
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 max-w-5xl mx-auto pt-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-6 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="h-3 w-20 rounded bg-stone-200 dark:bg-stone-700" />
            <div className="h-10 w-32 rounded bg-stone-300 dark:bg-stone-600" />
            <div className="h-3 w-full rounded bg-stone-200 dark:bg-stone-700" />
          </div>
        ))}
      </div>

      <span className="sr-only">Caricamento forecast.</span>
    </div>
  );
}
