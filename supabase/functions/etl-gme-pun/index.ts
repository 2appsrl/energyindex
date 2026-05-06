/**
 * Edge Function `etl-gme-pun` — Slice 1 Task 7.
 *
 * 1) Bootstrap DNN session sulla pagina contenitore PUN.
 * 2) Fetch PUN nazionale + 6 zone fisiche per oggi (fallback ieri se vuoto).
 * 3) Parse via parseGmePun (single source of truth, condiviso con i test Vitest).
 * 4) UPSERT 168 righe in price_observations (24h × 7 serie).
 * 5) Refresh materialized view mv_latest_price_per_asset.
 *
 * Invocata da pg_cron (Task 8) col service_role_key, e da curl manuale per
 * smoke-test. Niente auth utente: --no-verify-jwt al deploy.
 */
import { runEtl } from "../_shared/etl-runner.ts";
import {
  bootstrapGmeDnnSession,
  gmeApiGet,
  GME_BASE,
  type GmeDnnSession,
} from "../_shared/gme-dnn.ts";
import {
  parseGmePun,
  GmeRowSchema,
  PHYSICAL_ZONES,
  type GmeRow,
} from "../_shared/parsers/gme-pun.ts";
import { dbServiceRole, refreshLatestPriceView } from "../_shared/db.ts";

const PAGE_PATH = "/it-it/Home/Esiti/Elettricita/MGP/Esiti/PUN";
const PAGE_URL = GME_BASE + PAGE_PATH;
const API_PATH = "/DesktopModules/GmeEsitiPrezziME/API/item/GetMEPrezzi";
const ZONES = PHYSICAL_ZONES; // ["NORD","CNOR","CSUD","SUD","SICI","SARD"]
type Zone = (typeof ZONES)[number];

function isoDateInRome(d: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function compactDate(iso: string): string {
  return iso.replace(/-/g, "");
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchSeries(
  session: GmeDnnSession,
  zona: "PUN" | Zone,
  dataCompact: string,
): Promise<GmeRow[]> {
  // Tipologia=PUN solo per la zona PUN; per le 6 zone fisiche -> PrezziZonali.
  const tipologia = zona === "PUN" ? "PUN" : "PrezziZonali";
  const { status, body } = await gmeApiGet(session, API_PATH, {
    DataInizio: dataCompact,
    DataFine: dataCompact,
    Granularita: "h",
    Mercato: "MGP",
    Zona: zona,
    Tipologia: tipologia,
  });
  if (status !== 200) {
    throw new Error(`GME ${zona} HTTP ${status} (${body.length} bytes)`);
  }
  const arr = JSON.parse(body);
  if (!Array.isArray(arr)) {
    throw new Error(`GME ${zona} risposta non array`);
  }
  return arr.map((r) => GmeRowSchema.parse(r));
}

Deno.serve(async () => {
  return runEtl("gme-pun", async (ctx) => {
    const session = await bootstrapGmeDnnSession(PAGE_URL);
    ctx.log("dnn session ok", {
      tabId: session.tabId,
      moduleId: session.moduleId,
      pageBytes: session.pageBytes,
    });

    // Prova oggi; fallback ieri se vuoto (asta MGP chiude ~12:30).
    let date = isoDateInRome();
    let punRows = await fetchSeries(session, "PUN", compactDate(date));
    if (punRows.length === 0) {
      const yesterday = addDaysIso(date, -1);
      ctx.log("today empty, fallback to yesterday", { from: date, to: yesterday });
      date = yesterday;
      punRows = await fetchSeries(session, "PUN", compactDate(date));
    }

    const zoneRows: Record<string, GmeRow[]> = {};
    for (const z of ZONES) {
      zoneRows[z] = await fetchSeries(session, z, compactDate(date));
    }

    // Costruisce il combined sample atteso da parseGmePun (single source of truth).
    const combined = {
      source: "gme-mgp-pun" as const,
      url_base: GME_BASE,
      fetched_at: new Date().toISOString(),
      data_date: date,
      pun: punRows,
      zones: zoneRows,
    };
    const parsed = parseGmePun(JSON.stringify(combined));

    if (parsed.pun_national.length !== 24) {
      throw new Error(`expected 24 PUN values, got ${parsed.pun_national.length}`);
    }
    ctx.log("parsed", {
      national: parsed.pun_national.length,
      zones: Object.keys(parsed.zonal).length,
    });

    const slugMap: Record<Zone | "NATIONAL", string> = {
      NATIONAL: "pun",
      NORD: "pun-zona-nord",
      CNOR: "pun-zona-cnor",
      CSUD: "pun-zona-csud",
      SUD: "pun-zona-sud",
      SICI: "pun-zona-sici",
      SARD: "pun-zona-sard",
    };

    const db = dbServiceRole();
    const slugs = Object.values(slugMap);
    const { data: assets, error: assetErr } = await db
      .from("assets")
      .select("id, slug")
      .in("slug", slugs);
    if (assetErr || !assets) throw new Error(`fetch assets: ${assetErr?.message}`);
    const slugToId = new Map(
      assets.map((a) => [a.slug as string, a.id as number]),
    );

    const rows: Array<{
      asset_id: number;
      observed_at: string;
      value: number;
      granularity: string;
      extra: Record<string, unknown>;
    }> = [];

    for (const point of parsed.pun_national) {
      const id = slugToId.get("pun");
      if (!id) throw new Error("asset 'pun' not seeded");
      rows.push({
        asset_id: id,
        observed_at: hourToIso(date, point.hour),
        value: point.value,
        granularity: "hourly",
        extra: { source_hour: point.hour },
      });
    }
    for (const z of ZONES) {
      const series = parsed.zonal[z] ?? [];
      const id = slugToId.get(slugMap[z]);
      if (!id) throw new Error(`asset '${slugMap[z]}' not seeded`);
      for (const point of series) {
        rows.push({
          asset_id: id,
          observed_at: hourToIso(date, point.hour),
          value: point.value,
          granularity: "hourly",
          extra: { source_hour: point.hour, zone: z },
        });
      }
    }

    const { error: upsertErr } = await db
      .from("price_observations")
      .upsert(rows, { onConflict: "asset_id,observed_at" });
    if (upsertErr) throw new Error(`upsert: ${upsertErr.message}`);
    ctx.log("upserted", { rows: rows.length });

    await refreshLatestPriceView(db);
    ctx.log("mv refreshed");

    return { rows_ingested: rows.length, metadata: { date } };
  });
});

function hourToIso(date: string, hour: number): string {
  // hour: 1..24 (o 25 nel giorno DST autunno). Convenzione: hour 1 = 00:00-01:00.
  // Slice 1 simplification: assume CEST (+02:00) anno-rotondo.
  // Sbagliato da fine-Ott a fine-Mar (CET +01:00). Slice 7 introdurrà tz DST-aware.
  const h = String(hour - 1).padStart(2, "0");
  return `${date}T${h}:00:00+02:00`;
}
