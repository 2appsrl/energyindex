/**
 * Helper condivisi per gli endpoint pubblici /api/v1/* — fetcha l'ultimo
 * valore osservato di un asset (PUN, PSV, TTF, Brent, CO2) e lo
 * serializza nel formato JSON pubblicato.
 *
 * Mantenere QUI la conversione di unita' (es. €/MWh → €/kWh) cosi' il
 * formato di output e' consistente tra i 3 endpoint che lo riusano.
 */

import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";

export interface LatestPriceJson {
  /** Data di osservazione (YYYY-MM-DD, fuso UTC). */
  date: string;
  /** Timestamp ISO 8601 completo dell'osservazione. */
  observed_at: string;
  /** Valore nell'unita' "consumer-friendly" (€/kWh per energia, $/bbl per Brent, etc.). */
  value: number;
  /** Unita' del campo `value`. */
  unit: string;
  /** Valore nell'unita' nativa GME (€/MWh per PUN/PSV/TTF). Null se gia' coincide con `value`. */
  value_native?: number;
  /** Unita' nativa. Null se gia' coincide con `unit`. */
  unit_native?: string;
  /** Sigla dell'asset (PUN, PSV, ...). */
  asset: string;
  /** Nome esteso human-readable. */
  asset_name: string;
  /** Fonte upstream (GME, ICE, EIA, ...). */
  source: string;
  /** URL della fonte upstream. */
  source_url: string;
  /** Stringa di attribuzione obbligatoria per chi consuma l'API. */
  attribution: string;
  /** Pagina di dettaglio Energy Index — backlink reciproco. */
  page: string;
}

interface AssetDef {
  slug: string;
  asset: string;
  name: string;
  source: string;
  sourceUrl: string;
  /** Conversione: se native = €/MWh e consumer = €/kWh → divider = 1000. */
  consumerDivider: number;
  consumerUnit: string;
  page: string;
}

const ASSETS: Record<string, AssetDef> = {
  pun: {
    slug: "pun",
    asset: "PUN",
    name: "Prezzo Unico Nazionale energia elettrica Italia",
    source: "GME",
    sourceUrl: "https://www.mercatoelettrico.org",
    consumerDivider: 1000, // €/MWh → €/kWh
    consumerUnit: "€/kWh",
    page: "https://energyindex.it/it/indice/pun",
  },
  psv: {
    slug: "psv",
    asset: "PSV",
    name: "Punto di Scambio Virtuale gas naturale Italia",
    source: "GME",
    sourceUrl: "https://www.mercatoelettrico.org",
    consumerDivider: 1000,
    consumerUnit: "€/kWh",
    page: "https://energyindex.it/it/indice/psv",
  },
  ttf: {
    slug: "ttf",
    asset: "TTF",
    name: "Title Transfer Facility gas Europa",
    source: "ICE Endex",
    sourceUrl: "https://www.theice.com",
    consumerDivider: 1000,
    consumerUnit: "€/kWh",
    page: "https://energyindex.it/it/indice/ttf",
  },
  brent: {
    slug: "brent",
    asset: "Brent",
    name: "Brent crude oil (North Sea)",
    source: "EIA",
    sourceUrl: "https://www.eia.gov",
    consumerDivider: 1, // gia' $/bbl, niente conversione
    consumerUnit: "$/bbl",
    page: "https://energyindex.it/it/indice/brent",
  },
  co2: {
    slug: "co2",
    asset: "CO2",
    name: "Quota emissione CO2 EU ETS (EUA settlement)",
    source: "EEX",
    sourceUrl: "https://www.eex.com",
    consumerDivider: 1, // gia' €/tCO2
    consumerUnit: "€/tCO2",
    page: "https://energyindex.it/it/indice/co2",
  },
};

const ATTRIBUTION = "Energy Index — https://energyindex.it (gratis, attribuzione richiesta)";

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
      .select("observed_at, value")
      .eq("asset_id", meta.asset_id)
      .order("observed_at", { ascending: false })
      .limit(1);
    if (!rows?.[0]) return null;

    const nativeValue = Number(rows[0].value);
    const nativeUnit = String(meta.unit ?? "€/MWh");
    const consumerValue = nativeValue / def.consumerDivider;
    const observedAtStr = String(rows[0].observed_at);

    const json: LatestPriceJson = {
      date: observedAtStr.slice(0, 10),
      observed_at: observedAtStr,
      // €/kWh con 5 decimali (precisione ~0.001 cent), tipico per le bollette;
      // assets non-energy mantengono 2 decimali
      value: Number(
        def.consumerDivider === 1000
          ? consumerValue.toFixed(5)
          : consumerValue.toFixed(2),
      ),
      unit: def.consumerUnit,
      asset: def.asset,
      asset_name: def.name,
      source: def.source,
      source_url: def.sourceUrl,
      attribution: ATTRIBUTION,
      page: def.page,
    };

    // Aggiungi unita' nativa solo se differente dalla consumer
    if (def.consumerDivider !== 1) {
      json.value_native = Number(nativeValue.toFixed(2));
      json.unit_native = nativeUnit;
    }

    return json;
  },
);

/** Header di risposta condivisi: CORS aperto + cache 15 min + content-type. */
export const apiHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=900, s-maxage=900, stale-while-revalidate=3600",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

/** Lista degli asset disponibili per l'endpoint /api/v1/today. */
export const ALL_ASSETS = Object.keys(ASSETS);
