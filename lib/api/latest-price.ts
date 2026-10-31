/**
 * Helper condivisi per gli endpoint pubblici /api/v1/* — fetcha l'ultimo
 * valore osservato di un asset (PUN, PSV, TTF, Brent, CO2) e lo
 * serializza nel formato JSON pubblicato.
 *
 * Formato, unita' e date stanno in lib/api/price-json.ts (puro, testato),
 * cosi' l'output e' consistente tra i 3 endpoint che lo riusano.
 */

import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { ASSETS, buildLatestPriceJson, dailyAverageFor, type LatestPriceJson } from "@/lib/api/price-json";
import { romeDateOf, romeDayBoundsUtc } from "@/supabase/functions/_shared/rome-time";
import { API_EXPOSE_HEADERS } from "@/lib/api-keys/gate";

export type { LatestPriceJson } from "@/lib/api/price-json";

/**
 * Fetcha l'ultima osservazione di un asset (memoizzata per request).
 * Ritorna null se l'asset non esiste o non ha osservazioni.
 */
export const fetchLatestPrice = cache(
  async (assetSlug: string): Promise<LatestPriceJson | null> => {
    const def = ASSETS[assetSlug];
    if (!def) return null;

    const supabase = await createServerClient();
    const { data: meta } = await supabase
      .from("mv_latest_price_per_asset")
      .select("asset_id, unit")
      .eq("asset_slug", def.slug)
      .maybeSingle();
    if (!meta) return null;

    const { data: rows } = await supabase
      .from("price_observations")
      .select("observed_at, value, extra")
      .eq("asset_id", meta.asset_id)
      .order("observed_at", { ascending: false })
      .limit(1);
    if (!rows?.[0]) return null;

    // PUN: l'ultima ora pubblicata e' di norma di domani (MGP), quindi la
    // media "di oggi" si calcola a parte sulle ore del giorno italiano.
    let dailyAverage = null;
    if (assetSlug === "pun") {
      const today = romeDateOf(new Date());
      const { data: hours } = await supabase
        .from("price_observations")
        .select("observed_at, value")
        .eq("asset_id", meta.asset_id)
        .lt("observed_at", romeDayBoundsUtc(today).end)
        .order("observed_at", { ascending: false })
        .limit(75);
      dailyAverage = dailyAverageFor(hours ?? [], today);
    }

    return buildLatestPriceJson(assetSlug, rows[0], String(meta.unit ?? "€/MWh"), dailyAverage);
  },
);

/** Header di risposta condivisi: CORS aperto + cache 15 min + content-type. */
export const apiHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=900, s-maxage=900, stale-while-revalidate=3600",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Expose-Headers": API_EXPOSE_HEADERS,
} as const;

/** Lista degli asset disponibili per l'endpoint /api/v1/today. */
export const ALL_ASSETS = Object.keys(ASSETS);
