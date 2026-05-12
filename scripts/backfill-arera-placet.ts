/**
 * One-shot backfill ARERA PLACET 1Y.
 *
 * Itera da BACKFILL_START a ieri, scarica E + G CSV per ogni giorno,
 * parse, upsert in arera_offers, computa aggregati per-giorno e upsert
 * in energy_index_aggregates.
 *
 * Idempotente. Env-driven: BACKFILL_START, BACKFILL_END, BACKFILL_SLEEP_MS.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import {
  parsePlacetElectric,
  parsePlacetGas,
  statsFor,
  type PlacetOffer,
} from "../supabase/functions/_shared/parsers/arera-placet.js";

const ARERA_BASE = "https://www.ilportaleofferte.it";
const USER_AGENT =
  "EnergyIndex/0.1 (commerciale@deagroup.biz; +https://energyindex.it)";

const START_DATE = process.env.BACKFILL_START ?? (() => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
})();
const END_DATE_OVERRIDE = process.env.BACKFILL_END ?? null;
const SLEEP_MS = Number(process.env.BACKFILL_SLEEP_MS ?? 500);
const PROGRESS_EVERY_DAYS = 30;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysIso(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildPlacetUrl(isoDate: string, kind: "E" | "G"): string {
  const [yyyy, mm, dd] = isoDate.split("-");
  const monthNoZero = String(parseInt(mm, 10));
  const compact = `${yyyy}${mm}${dd}`;
  return `${ARERA_BASE}/portaleOfferte/resources/opendata/csv/offerte/${yyyy}_${monthNoZero}/PO_Offerte_${kind}_PLACET_${compact}.csv`;
}

function ddmmyyyyToIso(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

async function fetchCsv(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  return { status: res.status, body: await res.text() };
}

function offersToRows(
  offers: PlacetOffer[],
  commodity: "electricity" | "gas",
  asOfIsoDate: string,
) {
  return offers
    .filter((o) => Number.isFinite(o.prezzo_energia))
    .map((o) => {
      const vfIso = ddmmyyyyToIso(o.data_inizio) ?? asOfIsoDate;
      const vtIso = ddmmyyyyToIso(o.data_fine);
      const priceType: "fisso" | "variabile" =
        o.tipo_offerta === "prezzo fisso" ? "fisso" : "variabile";
      return {
        offer_code: o.codice,
        supplier: o.vendor,
        commodity,
        price_type: priceType,
        price_value: o.prezzo_energia,
        valid_from: `${vfIso}T00:00:00+01:00`,
        valid_to: vtIso ? `${vtIso}T23:59:59+01:00` : null,
        raw: o as unknown as Record<string, unknown>,
      };
    });
}

/**
 * Dedup batch by (offer_code, valid_from). ARERA pubblica piu' righe per
 * la stessa offerta con varianti regionali (regione/provincia/comune):
 * il `codice_offerta` ripete. Postgres UPSERT batch non gestisce duplicati
 * intra-batch ("ON CONFLICT DO UPDATE command cannot affect row a second
 * time"): teniamo la prima riga per ogni chiave.
 */
function dedupeByConflictKey<T extends { offer_code: string; valid_from: string }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = `${r.offer_code}|${r.valid_from}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY richiesti in .env.local");
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const end = END_DATE_OVERRIDE ?? addDaysIso(todayIso(), -1);
  let date = START_DATE;
  let totalRows = 0;
  let totalDays = 0;
  let emptyDays = 0;
  let errorDays = 0;
  const t0 = Date.now();

  console.log("backfill start", { from: START_DATE, to: end, sleepMs: SLEEP_MS });

  while (date <= end) {
    try {
      const [rE, rG] = await Promise.all([
        fetchCsv(buildPlacetUrl(date, "E")),
        fetchCsv(buildPlacetUrl(date, "G")),
      ]);
      await sleep(SLEEP_MS);

      // Se entrambi mancano -> day empty (weekend, holiday, ARERA gap)
      if (rE.status !== 200 && rG.status !== 200) {
        emptyDays++;
        date = addDaysIso(date, 1);
        continue;
      }

      // Parse isolato per commodity (schema drift in una non blocca l'altra).
      let offersE: PlacetOffer[] = [];
      let offersG: PlacetOffer[] = [];
      try {
        if (rE.status === 200) offersE = parsePlacetElectric(rE.body);
      } catch (err) {
        console.warn(`[${date}] parse E failed: ${(err as Error).message}`);
      }
      try {
        if (rG.status === 200) offersG = parsePlacetGas(rG.body);
      } catch (err) {
        console.warn(`[${date}] parse G failed: ${(err as Error).message}`);
      }

      const rows = dedupeByConflictKey([
        ...offersToRows(offersE, "electricity", date),
        ...offersToRows(offersG, "gas", date),
      ]);

      if (rows.length > 0) {
        const { error } = await db
          .from("arera_offers")
          .upsert(rows, { onConflict: "offer_code,valid_from" });
        if (error) throw new Error(`upsert ${date}: ${error.message}`);
        totalRows += rows.length;
      }

      // Aggregati per il giorno (skip se n=0)
      const aggs = [
        { slug: "mercato-libero-luce-fissa",     offers: offersE.filter((o) => o.tipo_offerta === "prezzo fisso"),     unit: "€/kWh" },
        { slug: "mercato-libero-luce-variabile", offers: offersE.filter((o) => o.tipo_offerta === "prezzo variabile"), unit: "€/kWh" },
        { slug: "mercato-libero-gas-fissa",      offers: offersG.filter((o) => o.tipo_offerta === "prezzo fisso"),     unit: "€/Smc" },
        { slug: "mercato-libero-gas-variabile",  offers: offersG.filter((o) => o.tipo_offerta === "prezzo variabile"), unit: "€/Smc" },
      ];
      const aggRows = aggs
        .map((a) => ({ ...a, stats: statsFor(a.offers) }))
        .filter((a) => a.stats.n > 0)
        .map((a) => ({
          aggregate_slug: a.slug,
          computed_at: date,
          median: a.stats.median,
          p25: Number.isFinite(a.stats.p25) ? a.stats.p25 : null,
          p75: Number.isFinite(a.stats.p75) ? a.stats.p75 : null,
          min: a.stats.min,
          max: a.stats.max,
          sample_size: a.stats.n,
          unit: a.unit,
        }));
      if (aggRows.length > 0) {
        const { error } = await db
          .from("energy_index_aggregates")
          .upsert(aggRows, { onConflict: "aggregate_slug,computed_at" });
        if (error) throw new Error(`upsert aggregates ${date}: ${error.message}`);
      }

      totalDays++;
      if (totalDays % PROGRESS_EVERY_DAYS === 0) {
        const el = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(
          `[${date}] +${rows.length} | total ${totalRows} / ${totalDays}d in ${el}s | empty ${emptyDays} | err ${errorDays}`,
        );
      }
    } catch (err) {
      errorDays++;
      console.error(`[${date}] errore: ${(err as Error).message}`);
    }
    date = addDaysIso(date, 1);
  }

  const el = ((Date.now() - t0) / 1000).toFixed(0);
  console.log("DONE", { totalRows, totalDays, emptyDays, errorDays, elapsedSec: el });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
