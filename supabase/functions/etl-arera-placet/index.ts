/**
 * Edge Function `etl-arera-placet` — Slice 4.
 *
 * !!! NON usata in produzione (vedi nota sotto). Mantenuta per riferimento. !!!
 *
 * ARERA blocca con 403 Forbidden le richieste dal range IP Supabase/AWS.
 * Confermato 2026-05-12: tutte le date provate ritornano 403 (Microsoft IIS WAF).
 * Le stesse URL funzionano da locale e da GitHub Actions runner.
 *
 * Workaround attivo: l'ETL daily gira da GitHub Actions invece di pg_cron.
 * File: .github/workflows/etl-arera-daily.yml
 *
 * Questa edge function resta deployata ma non deve essere invocata.
 * Verra' riattivata se in futuro ARERA toglie il block IP.
 *
 * Flow originale (preserved):
 * 1) Scarica i 2 CSV PLACET (Elettrico + Gas) per oggi.
 *    Fallback a ieri se 404.
 * 2) Parse via parsePlacetElectric / parsePlacetGas (shared parser).
 * 3) UPSERT righe in arera_offers con onConflict (offer_code, valid_from).
 * 4) Computa 4 aggregati e UPSERT in energy_index_aggregates.
 */
import { runEtl } from "../_shared/etl-runner.ts";
import {
  parsePlacetElectric,
  parsePlacetGas,
  statsFor,
  type PlacetOffer,
} from "../_shared/parsers/arera-placet.ts";
import { dbServiceRole } from "../_shared/db.ts";

const ARERA_BASE = "https://www.ilportaleofferte.it";
const USER_AGENT =
  "EnergyIndex/0.1 (commerciale@deagroup.biz; +https://energyindex.it)";

function isoDateInRome(d: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function buildPlacetUrl(isoDate: string, kind: "E" | "G"): string {
  const [yyyy, mm, dd] = isoDate.split("-");
  const monthNoZero = String(parseInt(mm, 10));
  const compact = `${yyyy}${mm}${dd}`;
  return `${ARERA_BASE}/portaleOfferte/resources/opendata/csv/offerte/${yyyy}_${monthNoZero}/PO_Offerte_${kind}_PLACET_${compact}.csv`;
}

/** parse 'gg/mm/yyyy' -> 'yyyy-mm-dd' ISO; null se invalido o vuoto */
function ddmmyyyyToIso(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

async function fetchCsv(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  return { status: res.status, body: await res.text() };
}

async function fetchPlacetForDate(
  isoDate: string,
  kind: "E" | "G",
): Promise<string | null> {
  const url = buildPlacetUrl(isoDate, kind);
  const r = await fetchCsv(url);
  if (r.status === 200) return r.body;
  return null;
}

function offersToRows(
  offers: PlacetOffer[],
  commodity: "electricity" | "gas",
  asOfIsoDate: string,
) {
  return offers
    .filter((o) => Number.isFinite(o.prezzo_energia))
    .map((o) => {
      const validFromIso = ddmmyyyyToIso(o.data_inizio) ?? asOfIsoDate;
      const validToIso = ddmmyyyyToIso(o.data_fine);
      const priceType: "fisso" | "variabile" =
        o.tipo_offerta === "prezzo fisso" ? "fisso" : "variabile";
      return {
        offer_code: o.codice,
        supplier: o.vendor,
        commodity,
        price_type: priceType,
        price_value: o.prezzo_energia,
        valid_from: `${validFromIso}T00:00:00+01:00`,
        valid_to: validToIso ? `${validToIso}T23:59:59+01:00` : null,
        raw: o as unknown as Record<string, unknown>,
      };
    });
}

Deno.serve(async () => {
  return runEtl("arera-placet", async (ctx) => {
    let asOf = isoDateInRome();

    // 1. Scarica E
    let csvE = await fetchPlacetForDate(asOf, "E");
    if (csvE === null) {
      const yesterday = addDaysIso(asOf, -1);
      ctx.log("today E missing, fallback to yesterday", {
        from: asOf,
        to: yesterday,
      });
      csvE = await fetchPlacetForDate(yesterday, "E");
      asOf = yesterday;
    }
    if (csvE === null) throw new Error("ARERA PLACET E non disponibile");

    // 2. Scarica G (DEVE essere stessa data di E per coerenza: mixare date
    // diverse in un singolo computed_at falserebbe gli aggregati). Se G manca
    // per asOf si throwa (no fallback): il giorno verra' riprocessato al
    // prossimo cron.
    const csvG = await fetchPlacetForDate(asOf, "G");
    if (csvG === null) {
      throw new Error(
        `ARERA PLACET G non disponibile per ${asOf} (E presente, G mancante: date mismatch evitato)`,
      );
    }

    // 3. Parse isolato per commodity: schema drift in una non blocca l'altra
    let offersE: PlacetOffer[] = [];
    let offersG: PlacetOffer[] = [];
    let parseEError: string | null = null;
    let parseGError: string | null = null;
    try {
      offersE = parsePlacetElectric(csvE);
    } catch (err) {
      parseEError = (err as Error).message;
      ctx.log("parse E failed", { error: parseEError });
    }
    try {
      offersG = parsePlacetGas(csvG);
    } catch (err) {
      parseGError = (err as Error).message;
      ctx.log("parse G failed", { error: parseGError });
    }
    if (offersE.length === 0 && offersG.length === 0) {
      throw new Error(
        `Both E and G parsing failed: E=${parseEError ?? "no offers"} | G=${parseGError ?? "no offers"}`,
      );
    }
    ctx.log("parsed", { e_offers: offersE.length, g_offers: offersG.length });

    const db = dbServiceRole();

    // 3. UPSERT arera_offers
    const rowsE = offersToRows(offersE, "electricity", asOf);
    const rowsG = offersToRows(offersG, "gas", asOf);
    const allRows = [...rowsE, ...rowsG];
    if (allRows.length > 0) {
      const { error } = await db
        .from("arera_offers")
        .upsert(allRows, { onConflict: "offer_code,valid_from" });
      if (error) throw new Error(`upsert arera_offers: ${error.message}`);
    }
    ctx.log("upserted arera_offers", { rows: allRows.length });

    // 4. Computa 4 aggregati per asOf. Filtro tipo_cliente='domestico' per
    // allineare la mediana al caso d'uso residenziale (business+condominio
    // gonfierebbero la mediana con tariffe non comparabili).
    const isDomestico = (o: PlacetOffer) => o.tipo_cliente === "domestico";
    const aggregates: Array<{
      slug: string;
      offers: PlacetOffer[];
      unit: string;
    }> = [
      {
        slug: "mercato-libero-luce-fissa",
        offers: offersE.filter((o) => o.tipo_offerta === "prezzo fisso" && isDomestico(o)),
        unit: "€/kWh",
      },
      {
        slug: "mercato-libero-luce-variabile",
        offers: offersE.filter((o) => o.tipo_offerta === "prezzo variabile" && isDomestico(o)),
        unit: "€/kWh",
      },
      {
        slug: "mercato-libero-gas-fissa",
        offers: offersG.filter((o) => o.tipo_offerta === "prezzo fisso" && isDomestico(o)),
        unit: "€/Smc",
      },
      {
        slug: "mercato-libero-gas-variabile",
        offers: offersG.filter((o) => o.tipo_offerta === "prezzo variabile" && isDomestico(o)),
        unit: "€/Smc",
      },
    ];

    // Skippa aggregati con n=0 per non scrivere righe sentinella "0 €/kWh"
    // che si confonderebbero con prezzi reali nei chart.
    const aggRows = aggregates
      .map((a) => ({ ...a, stats: statsFor(a.offers) }))
      .filter((a) => a.stats.n > 0)
      .map((a) => ({
        aggregate_slug: a.slug,
        computed_at: asOf,
        median: a.stats.median,
        p25: Number.isFinite(a.stats.p25) ? a.stats.p25 : null,
        p75: Number.isFinite(a.stats.p75) ? a.stats.p75 : null,
        min: a.stats.min,
        max: a.stats.max,
        sample_size: a.stats.n,
        unit: a.unit,
      }));
    if (aggRows.length > 0) {
      const { error: aggErr } = await db
        .from("energy_index_aggregates")
        .upsert(aggRows, { onConflict: "aggregate_slug,computed_at" });
      if (aggErr) throw new Error(`upsert aggregates: ${aggErr.message}`);
    }
    ctx.log("upserted aggregates", { rows: aggRows.length });

    return {
      rows_ingested: allRows.length,
      metadata: { as_of: asOf, aggregates: aggRows.length },
    };
  });
});
