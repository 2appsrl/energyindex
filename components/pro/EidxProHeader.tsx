/**
 * Header brandizzato EIDX Pro (dark green bar) per le rotte /pro/* che
 * sostituiscono il global SiteHeader. Server component, niente state.
 */
export function EidxProHeader({ section }: { section: string }) {
  const today = new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  return (
    <header className="bg-[#0a3d2e] text-white border-b border-emerald-400/20">
      <div className="container mx-auto flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-3 text-sm font-semibold tracking-wide">
          <span className="text-emerald-300">EIDX</span>
          <span className="text-white/30" aria-hidden>
            |
          </span>
          <span>{section}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/70">
          <span className="text-emerald-300 font-semibold tracking-widest uppercase">
            Enterprise
          </span>
          <span className="tabular-nums">v 0.1 &middot; {today}</span>
        </div>
      </div>
    </header>
  );
}
