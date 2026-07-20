import Link from "next/link";

/**
 * Header brandizzato EIDX Pro (dark green bar) per le rotte /pro/* che
 * sostituiscono il global SiteHeader. Server component, niente state.
 *
 * Include link "Contatti" (mailto + ancora al form sulla landing) sempre
 * visibile a destra, cosi' l'utente puo' raggiungere il team da qualsiasi
 * tool del Pro.
 */
export function EidxProHeader({ section }: { section: string }) {
  const today = new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  return (
    <header className="bg-[#0a3d2e] text-white border-b border-emerald-400/20">
      <div className="container mx-auto flex h-12 items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3 text-sm font-semibold tracking-wide min-w-0">
          <Link
            href="/it/pro"
            className="text-emerald-300 hover:text-emerald-200 transition-colors shrink-0"
          >
            EIDX
          </Link>
          <span className="text-white/30 shrink-0" aria-hidden>
            |
          </span>
          <span className="truncate">{section}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/70 shrink-0">
          <Link
            href="/it/pro#contatti"
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 font-semibold text-emerald-200 hover:bg-emerald-400/20 hover:text-emerald-100 transition-colors"
          >
            <span aria-hidden>✉</span>
            <span className="hidden sm:inline">Contatti</span>
          </Link>
          <span className="hidden md:inline text-emerald-300 font-semibold tracking-widest uppercase">
            Enterprise
          </span>
          <span className="hidden lg:inline tabular-nums">v 0.1 &middot; {today}</span>
        </div>
      </div>
    </header>
  );
}
