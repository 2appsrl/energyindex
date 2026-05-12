/**
 * ARERA Portale Offerte PLACET parser — pure, runtime-agnostic.
 *
 * Single source of truth importato sia dai test Vitest (Node runtime) sia
 * dall'Edge Function di ingestion (Deno runtime). Nessun I/O qui.
 *
 * Promosso da spikes/arera-offers.ts (Slice 4). Lo spike reimporta queste
 * export e mantiene solo main() + URL builders.
 */

/**
 * Schema PLACET elettrico (snapshot 2026-05-01): 26 colonne, separatore ',',
 * nessuna virgola embedded (verificato su 909 righe). Numeri con punto decimale.
 *
 * Indici di colonna 0-based per i campi rilevanti per Energy Index.
 */
const PLACET_E_COLS = {
  denominazione: 0,
  codice_offerta: 6,
  data_inizio: 10,
  data_fine: 11,
  tipo_cliente: 12,
  tipo_offerta: 13,
  p_fix_f: 14,
  p_fix_v: 15,
  p_vol_f1: 16,
  p_vol_f2: 17,
  p_vol_f3: 18,
  p_vol_bf1: 19,
  p_vol_bf23: 20,
  p_vol_mono: 21,
  alpha: 22,
} as const;

const PLACET_G_COLS = {
  denominazione: 0,
  codice_offerta: 6,
  data_inizio: 10,
  data_fine: 11,
  tipo_cliente: 12,
  tipo_offerta: 13,
  p_fix_f: 14,
  p_fix_v: 15,
  p_vol: 16,
  alpha: 17,
} as const;

export interface PlacetOffer {
  vendor: string;
  codice: string;
  data_inizio: string; // gg/mm/yyyy
  data_fine: string;
  tipo_cliente: string;
  tipo_offerta: "prezzo fisso" | "prezzo variabile" | string;
  /** Quota fissa annua applicata (qualunque dei p_fix_*). NaN se non specificata. */
  quota_fissa_eur_anno: number;
  /**
   * Prezzo "energia" comparabile, in EUR/kWh per elettrico, EUR/Smc per gas:
   *  - elettrico fisso: p_vol_mono (preferito) oppure media di p_vol_f1..f3
   *  - elettrico variabile: alpha (lo spread sull'indice e' il valore comparabile)
   *  - gas fisso: p_vol
   *  - gas variabile: alpha
   * NaN se non determinabile.
   */
  prezzo_energia: number;
}

/** Parsa il CSV PLACET elettrico (26 colonne). */
export function parsePlacetElectric(csvText: string): PlacetOffer[] {
  return parsePlacetGeneric(csvText, "electric");
}

/** Parsa il CSV PLACET gas (21 colonne). */
export function parsePlacetGas(csvText: string): PlacetOffer[] {
  return parsePlacetGeneric(csvText, "gas");
}

function parsePlacetGeneric(
  csvText: string,
  kind: "electric" | "gas",
): PlacetOffer[] {
  const expectedFields = kind === "electric" ? 26 : 21;
  const cols = kind === "electric" ? PLACET_E_COLS : PLACET_G_COLS;
  // Normalizza CRLF/LF e rimuovi BOM se presente.
  const text = csvText.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const rawLines = text.split("\n").filter((l) => l.length > 0);
  if (rawLines.length === 0) return [];

  // Riga 0 = header. Verifica che il numero di campi sia atteso (sanity check).
  const headerCols = rawLines[0].split(",");
  if (headerCols.length !== expectedFields) {
    throw new Error(
      `[parsePlacet${kind}] schema inatteso: header ha ${headerCols.length} campi, attesi ${expectedFields}.` +
        ` Header: ${rawLines[0].slice(0, 200)}`,
    );
  }

  const out: PlacetOffer[] = [];
  for (let i = 1; i < rawLines.length; i++) {
    const fields = rawLines[i].split(",");
    if (fields.length !== expectedFields) {
      throw new Error(
        `[parsePlacet${kind}] riga ${i + 1} ha ${fields.length} campi (attesi ${expectedFields})`,
      );
    }
    const tipo_offerta = fields[cols.tipo_offerta];
    const quota = pickNumber(
      fields[cols.p_fix_f],
      fields[cols.p_fix_v],
    );

    let prezzo_energia: number;
    if (kind === "electric") {
      const ec = cols as typeof PLACET_E_COLS;
      if (tipo_offerta === "prezzo fisso") {
        // Preferisci il monorario; in subordine media di f1..f3 non vuoti.
        const mono = parseNumOrNaN(fields[ec.p_vol_mono]);
        if (Number.isFinite(mono)) {
          prezzo_energia = mono;
        } else {
          const fasce = [
            fields[ec.p_vol_f1],
            fields[ec.p_vol_f2],
            fields[ec.p_vol_f3],
          ]
            .map(parseNumOrNaN)
            .filter((n) => Number.isFinite(n));
          prezzo_energia =
            fasce.length > 0
              ? fasce.reduce((s, x) => s + x, 0) / fasce.length
              : NaN;
        }
      } else {
        // Variabile: alpha (lo spread €/kWh sull'indice)
        prezzo_energia = parseNumOrNaN(fields[ec.alpha]);
      }
    } else {
      const gc = cols as typeof PLACET_G_COLS;
      if (tipo_offerta === "prezzo fisso") {
        prezzo_energia = parseNumOrNaN(fields[gc.p_vol]);
      } else {
        prezzo_energia = parseNumOrNaN(fields[gc.alpha]);
      }
    }

    out.push({
      vendor: fields[cols.denominazione],
      codice: fields[cols.codice_offerta],
      data_inizio: fields[cols.data_inizio],
      data_fine: fields[cols.data_fine],
      tipo_cliente: fields[cols.tipo_cliente],
      tipo_offerta,
      quota_fissa_eur_anno: quota,
      prezzo_energia,
    });
  }
  return out;
}

function parseNumOrNaN(raw: string | undefined): number {
  if (raw == null || raw === "") return NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

/** Restituisce il primo campo numerico parseabile, NaN se nessuno. */
function pickNumber(...candidates: (string | undefined)[]): number {
  for (const c of candidates) {
    const n = parseNumOrNaN(c);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

// ---------------------------------------------------------------------------
// Aggregati Energy Index
// ---------------------------------------------------------------------------

export interface AggregateStats {
  n: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

/** Quantile con interpolazione lineare. q in [0,1], xs deve essere ordinato. */
function quantile(xsSorted: number[], q: number): number {
  if (xsSorted.length === 0) return NaN;
  if (xsSorted.length === 1) return xsSorted[0];
  const pos = (xsSorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return xsSorted[lo];
  return xsSorted[lo] + (xsSorted[hi] - xsSorted[lo]) * (pos - lo);
}

export function statsFor(offers: PlacetOffer[]): AggregateStats {
  const xs = offers
    .map((o) => o.prezzo_energia)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  return {
    n: xs.length,
    min: xs.length ? xs[0] : NaN,
    p25: quantile(xs, 0.25),
    median: quantile(xs, 0.5),
    p75: quantile(xs, 0.75),
    max: xs.length ? xs[xs.length - 1] : NaN,
  };
}
