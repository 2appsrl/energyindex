"use client";

import { useCallback, useState } from "react";
import { MarketMap, type Offer } from "./MarketMap";
import { MarketMapSimulator } from "./MarketMapSimulator";

/**
 * Wrapper client che orchestra MarketMap + MarketMapSimulator condividendo
 * lo state `highlightedCodes`: il Simulator calcola i vincitori, la
 * MarketMap li evidenzia visivamente.
 *
 * page.tsx (server component) carica le offerte via RPC e le passa qui.
 * Il wrapping client e' minimo (solo state lifting) cosi' non rinuncia ai
 * benefici dello streaming Next.js.
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
      />
      <div className="relative z-10 bg-black px-4 sm:px-8 pb-12">
        <MarketMapSimulator offers={offers} onWinnersChange={handleWinnersChange} />
      </div>
    </>
  );
}
