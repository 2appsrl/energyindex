import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton per /it/indice/[slug].
 *
 * Senza questo file la navigazione dalla home restava "muta": la pagina e'
 * dynamic (legge searchParams) e fa piu' query Supabase in sequenza, quindi
 * il browser restava fermo sulla home per 1-4s senza feedback e l'utente
 * ricliccava. Con loading.tsx Next.js ha uno shell prefetchabile e mostra
 * subito questo fallback al click.
 *
 * Lo scheletro ricalca il layout reale (header, card valore, chart 300px)
 * per evitare il salto visivo quando arriva il contenuto.
 */
export default function IndiceLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="container mx-auto px-4 py-8 space-y-8"
    >
      <header className="space-y-3">
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-2/3 max-w-xl" />
      </header>

      {/* Card valore corrente */}
      <div className="rounded-xl border p-6 flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-11 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Grafico: stessa altezza del PriceChart (300px) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-3 w-64" />
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-10" />
            ))}
          </div>
        </div>
        <div className="relative h-[300px] w-full overflow-hidden rounded-lg border">
          <Skeleton className="h-full w-full" />
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            <span
              className="h-8 w-8 rounded-full border-[3px] border-muted-foreground/20 border-t-primary animate-spin"
              aria-hidden
            />
            <span className="text-sm font-medium text-muted-foreground">
              Caricamento dati di mercato...
            </span>
          </div>
        </div>
      </section>

      <span className="sr-only">Caricamento della pagina indice in corso.</span>
    </div>
  );
}
