/**
 * GME PSV parser — pure, runtime-agnostic.
 *
 * Single source of truth importato sia dai test Vitest (Node runtime) sia
 * dall'Edge Function di ingestion (Deno runtime). La risoluzione di "zod"
 * funziona in entrambi grazie all'import map (supabase/functions/_shared/deno.json)
 * lato Deno e al normale node_modules lato Node.
 *
 * Promosso da spikes/gme-psv.ts (Slice 2). Lo spike resta runnable e
 * reimporta parseGmePsv da qui.
 */
import { z } from "zod";

export const GmeMgasRowSchema = z.object({
  data: z.number().int(),
  prodotto: z.string(),
  firstPrice: z.number().nullable(),
  lastPrice: z.number().nullable(),
  prezzoMinimo: z.number().nullable(),
  prezzoMassimo: z.number().nullable(),
  prezzoRiferimento: z.number().nullable(),
  prezzoControllo: z.number().nullable(),
  prezzoAcquisto: z.number().nullable(),
  prezzoVendita: z.number().nullable(),
  volumiMW: z.number().nullable(),
  volumiMWh: z.number().nullable(),
  volumiOTCMW: z.number().nullable(),
  volumiOTCMWh: z.number().nullable(),
  posizioniAperte: z.number().nullable(),
});
export type GmeMgasRow = z.infer<typeof GmeMgasRowSchema>;

export const CombinedSampleSchema = z.object({
  source: z.literal("gme-mgp-gas-psv"),
  url_base: z.string(),
  fetched_at: z.string(),
  sessions: z.array(
    z.object({
      session_date: z.string(),
      http_status: z.number().int(),
      rows: z.array(GmeMgasRowSchema),
    }),
  ),
});
export type CombinedSample = z.infer<typeof CombinedSampleSchema>;

export const DailyPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number(),
});
export const ParseResultSchema = z.object({
  points: z.array(DailyPointSchema),
});
export type ParseResult = z.infer<typeof ParseResultSchema>;

function deliveryDateFromProdotto(prodotto: string): string | null {
  const m = prodotto.match(/^MGP-(\d{4}-\d{2}-\d{2})$/);
  return m ? m[1] : null;
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function parseGmePsv(rawContent: string): ParseResult {
  const json = JSON.parse(rawContent) as unknown;
  const sample = CombinedSampleSchema.parse(json);

  const byDeliveryDate = new Map<string, { value: number; sessionDate: string }>();

  for (const session of sample.sessions) {
    const expectedNextDay = addDaysIso(session.session_date, 1);
    for (const row of session.rows) {
      const delivery = deliveryDateFromProdotto(row.prodotto);
      if (delivery !== expectedNextDay) continue;
      if (row.prezzoRiferimento === null) continue;
      const existing = byDeliveryDate.get(delivery);
      if (!existing || existing.sessionDate < session.session_date) {
        byDeliveryDate.set(delivery, {
          value: row.prezzoRiferimento,
          sessionDate: session.session_date,
        });
      }
    }
  }

  const points = Array.from(byDeliveryDate.entries())
    .map(([date, v]) => ({ date, value: v.value }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return ParseResultSchema.parse({ points });
}
