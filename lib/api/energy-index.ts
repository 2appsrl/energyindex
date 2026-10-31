/**
 * Serializzazione pura di /api/v1/energy-index: ultimo snapshot dei 4
 * indici proprietari (energy_index_aggregates), calcolati sulle offerte
 * del Portale Offerte ARERA. Sono elaborazioni Energy Index, quindi
 * riusabili con attribuzione (a differenza dei dati GME).
 *
 * Per gli indici a prezzo fisso le statistiche sono il prezzo; per quelli
 * variabili sono lo spread (alpha) sopra il riferimento all'ingrosso
 * (PUN per la luce, PSV per il gas), nella stessa unita'.
 */

import { AGGREGATE_SLUGS } from "@/lib/arera-aggregates";

export interface AggregateRow {
  aggregate_slug: string;
  computed_at: string;
  median: number | string;
  p25: number | string | null;
  p75: number | string | null;
  min: number | string;
  max: number | string;
  sample_size: number;
  spread_vs_reference_pct: number | string | null;
  unit: string;
}

export interface EnergyIndexItem {
  slug: string;
  name: string;
  commodity: "luce" | "gas";
  price_type: "fisso" | "variabile";
  /** "prezzo" per i fissi; "spread" per i variabili (statistiche = alpha sopra `reference`). */
  basis: "prezzo" | "spread";
  /** Solo variabili: riferimento all'ingrosso a cui si somma lo spread. */
  reference?: "PUN" | "PSV";
  unit: string;
  date: string;
  median: number;
  p25: number | null;
  p75: number | null;
  min: number;
  max: number;
  offers: number;
  spread_vs_reference_pct?: number;
  page: string;
}

export interface EnergyIndexJson {
  updated_at: string | null;
  indices: EnergyIndexItem[];
  source: string;
  attribution: string;
  page: string;
}

export const ENERGY_INDEX_ATTRIBUTION =
  "Fonte: Energy Index (https://energyindex.it) — elaborazione su dati Portale Offerte ARERA";

const round = (v: number | string, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(Number(v) * f) / f;
};
const stat = (v: number | string): number => round(v, 4);
const statOrNull = (v: number | string | null): number | null => (v === null ? null : stat(v));

function referenceOf(slug: string): "PUN" | "PSV" | undefined {
  const ref = slug.toUpperCase();
  return ref === "PUN" || ref === "PSV" ? ref : undefined;
}

export function latestPerSlug(rows: AggregateRow[]): AggregateRow[] {
  const best = new Map<string, AggregateRow>();
  for (const r of rows) {
    const cur = best.get(r.aggregate_slug);
    if (!cur || r.computed_at > cur.computed_at) best.set(r.aggregate_slug, r);
  }
  return [...best.values()];
}

export function buildEnergyIndexJson(rows: AggregateRow[], commodity?: "luce" | "gas"): EnergyIndexJson {
  const indices: EnergyIndexItem[] = [];
  for (const def of AGGREGATE_SLUGS) {
    const r = rows.find((x) => x.aggregate_slug === def.slug);
    if (!r) continue;
    const c = def.commodity === "electricity" ? "luce" : "gas";
    if (commodity && c !== commodity) continue;
    const item: EnergyIndexItem = {
      slug: def.slug,
      name: `Energy Index · ${def.displayName}`,
      commodity: c,
      price_type: def.priceType,
      basis: def.priceType === "variabile" ? "spread" : "prezzo",
      unit: r.unit,
      date: r.computed_at,
      median: stat(r.median),
      p25: statOrNull(r.p25),
      p75: statOrNull(r.p75),
      min: stat(r.min),
      max: stat(r.max),
      offers: r.sample_size,
      page: "https://energyindex.it/it/mercato-libero",
    };
    if (def.priceType === "variabile") {
      const ref = referenceOf(def.referenceAssetSlug);
      if (ref) item.reference = ref;
      if (r.spread_vs_reference_pct !== null) {
        item.spread_vs_reference_pct = round(r.spread_vs_reference_pct, 2);
      }
    }
    indices.push(item);
  }
  const updated = indices.reduce<string | null>((m, i) => (m && m > i.date ? m : i.date), null);
  return {
    updated_at: updated,
    indices,
    source: "ARERA — Portale Offerte",
    attribution: ENERGY_INDEX_ATTRIBUTION,
    page: "https://energyindex.it/it/mercato-libero",
  };
}
