"use client";

import { useCallback, useState } from "react";
import { MarketMap, type Offer, type SortMode } from "./MarketMap";
import { MarketMapSimulator } from "./MarketMapSimulator";

/**
 * Wrapper client che orchestra MarketMap + MarketMapSimulator condividendo:
 *  - highlightedCodes : Simulator → MarketMap (winner tile glow)
 *  - sortMode         : MarketMap header → MarketMap section sort
 *  - kwhAnno / smcAnno: Simulator sliders → MarketMap sortMode="consumo"
 *
 * page.tsx (server component) carica le offerte via RPC e le passa qui.
 * Il wrapping client e' minimo (solo state lifting) cosi' non rinuncia ai
 * benefici dello streaming Next.js.
 *
 * Default consumi = 0: l'utente vede il simulator "vuoto" e deve
 * muovere gli slider per ottenere la "Migliore offerta". Cosi' evitiamo
 * di mostrare un winner basato su consumi presunti che potrebbero non
 * essere i suoi. Quando consumi=0, sortMode="consumo" collassa su PCV
 * (perche' price*0 = 0, resta solo la quota fissa).
 */
export function MarketMapWithSimulator({
  offers,
  asOf,
  source,
}: {
  offers: Offer[];
  asOf: string | null;
  source: "all" | "placet" | "libero";
}) {
  const [highlightedCodes, setHighlightedCodes] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("price");
  const [kwhAnno, setKwhAnno] = useState(0);
  const [smcAnno, setSmcAnno] = useState(0);

  const handleWinnersChange = useCallback((codes: string[]) => {
    // setState in callback — evita ri-render circolari con useMemo nel child
    setHighlightedCodes((prev) => {
      if (prev.length === codes.length && prev.every((c, i) => c === codes[i])) {
        return prev;
      }
      return codes;
    });
  }, []);

  return (
    <>
      <MarketMap
        offers={offers}
        asOf={asOf}
        source={source}
        highlightedCodes={highlightedCodes}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        kwhAnno={kwhAnno}
        smcAnno={smcAnno}
      />
      <div className="relative z-10 bg-black px-4 sm:px-8 pb-12">
        <MarketMapSimulator
          offers={offers}
          onWinnersChange={handleWinnersChange}
          kwhAnno={kwhAnno}
          smcAnno={smcAnno}
          onKwhAnnoChange={setKwhAnno}
          onSmcAnnoChange={setSmcAnno}
        />
      </div>
    </>
  );
}
