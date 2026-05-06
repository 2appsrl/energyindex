/**
 * GME PUN parser — pure, runtime-agnostic.
 *
 * Single source of truth importato sia dai test Vitest (Node runtime) sia
 * dall'Edge Function di ingestion (Deno runtime). La risoluzione di "zod"
 * funziona in entrambi grazie all'import map (`supabase/functions/_shared/deno.json`)
 * lato Deno e al normale node_modules lato Node.
 *
 * Nessun I/O qui: niente fetch, niente fs, niente process.env / Deno.env,
 * niente console.log. Solo `string in -> ParseResult out`.
 *
 * Promosso da `spikes/gme-pun.ts` (Slice 1, Task 5). Lo spike resta come
 * tool runnable e ora reimporta `parseGmePun` da qui.
 */
import { z } from "zod";

/** I 6 codici zona fisici richiesti dal piano. */
export const PHYSICAL_ZONES = ["NORD", "CNOR", "CSUD", "SUD", "SICI", "SARD"] as const;
export type PhysicalZone = (typeof PHYSICAL_ZONES)[number];

// ---------------------------------------------------------------------------
// Schemas (zod)
// ---------------------------------------------------------------------------

/**
 * Riga raw del backend GME: numeri arrivano già come number JSON (non stringhe).
 * Resta uno schema esplicito per rilevare regressioni.
 */
export const GmeRowSchema = z.object({
  df: z.number().int(), // data flusso YYYYMMDD
  h: z.number().int().min(1).max(25), // 1..24 (25 il giorno DST in autunno)
  p: z.number(), // prezzo €/MWh
  qh: z.number().int().optional(),
});
export type GmeRow = z.infer<typeof GmeRowSchema>;

/** Forma del file combinato che salviamo come fixture. */
export const CombinedSampleSchema = z.object({
  source: z.literal("gme-mgp-pun"),
  url_base: z.string(),
  fetched_at: z.string(),
  data_date: z.string(), // YYYY-MM-DD
  pun: z.array(GmeRowSchema),
  zones: z.record(z.string(), z.array(GmeRowSchema)),
});
export type CombinedSample = z.infer<typeof CombinedSampleSchema>;

/** Output del parser: forma normalizzata definita dal piano. */
export const HourlyPointSchema = z.object({
  hour: z.number().int().min(1).max(25),
  value: z.number(),
});
export const ParseResultSchema = z.object({
  pun_national: z.array(HourlyPointSchema),
  zonal: z.object({
    NORD: z.array(HourlyPointSchema),
    CNOR: z.array(HourlyPointSchema),
    CSUD: z.array(HourlyPointSchema),
    SUD: z.array(HourlyPointSchema),
    SICI: z.array(HourlyPointSchema),
    SARD: z.array(HourlyPointSchema),
  }),
});
export type ParseResult = z.infer<typeof ParseResultSchema>;

// ---------------------------------------------------------------------------
// Pure parser (testabile su fixture)
// ---------------------------------------------------------------------------

/**
 * Parsa il sample combinato JSON salvato dallo spike.
 * Ritorna 24 punti PUN nazionali + 24 punti × 6 zone fisiche.
 */
export function parseGmePun(rawContent: string): ParseResult {
  const json = JSON.parse(rawContent) as unknown;
  const sample = CombinedSampleSchema.parse(json);

  const toPoints = (rows: GmeRow[]) =>
    rows
      .slice()
      .sort((a, b) => a.h - b.h)
      .map((r) => ({ hour: r.h, value: r.p }));

  const pun_national = toPoints(sample.pun);

  const zonal = {} as ParseResult["zonal"];
  for (const code of PHYSICAL_ZONES) {
    const rows = sample.zones[code];
    if (!rows) {
      throw new Error(`[parseGmePun] zona ${code} mancante nel sample`);
    }
    (zonal as Record<PhysicalZone, { hour: number; value: number }[]>)[code] =
      toPoints(rows);
  }

  return ParseResultSchema.parse({ pun_national, zonal });
}
