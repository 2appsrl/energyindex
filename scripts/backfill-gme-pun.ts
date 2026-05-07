/**
 * One-shot backfill PUN dall'archivio GME.
 *
 * Itera da START_DATE a ieri, fetcha PUN nazionale + 6 zone fisiche per ogni
 * giorno, parse via parseGmePun (single source of truth), upsert in
 * price_observations. Idempotente (UNIQUE asset_id+observed_at).
 *
 * Eseguibile localmente: `npm run backfill:gme-pun`
 * Richiede in .env.local: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  bootstrapGmeDnnSession,
  gmeApiGet,
  GME_BASE,
  type GmeDnnSession,
} from "../supabase/functions/_shared/gme-dnn.js";
import {
  parseGmePun,
  GmeRowSchema,
  PHYSICAL_ZONES,
  type GmeRow,
} from "../supabase/functions/_shared/parsers/gme-pun.js";

const PAGE_PATH = "/it-it/Home/Esiti/Elettricita/MGP/Esiti/PUN";
const PAGE_URL = GME_BASE + PAGE_PATH;
const API_PATH = "/DesktopModules/GmeEsitiPrezziME/API/item/GetMEPrezzi";
const ZONES = PHYSICAL_ZONES;
type Zone = (typeof ZONES)[number];

// 5 anni fino a ieri.
const START_DATE = "2021-05-07";
const SLEEP_MS = 150;
const PROGRESS_EVERY_DAYS = 30;

function compactDate(iso: string) {
  return iso.replace(/-/g, "");
}
function addDaysIso(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function hourToIso(date: string, hour: number) {
  // hour 1..24 -> ISO con offset CEST. Stessa simplification del ETL day-to-day.
  const h = String(hour - 1).padStart(2, "0");
  return `${date}T${h}:00:00+02:00`;
}

async function fetchSeries(
  session: GmeDnnSession,
  zona: "PUN" | Zone,
  dataCompact: string,
): Promise<GmeRow[]> {
  const tipologia = zona === "PUN" ? "PUN" : "PrezziZonali";
  const { status, body } = await gmeApiGet(session, API_PATH, {
    DataInizio: dataCompact,
    DataFine: dataCompact,
    Granularita: "h",
    Mercato: "MGP",
    Zona: zona,
    Tipologia: tipologia,
  });
  if (status !== 200) throw new Error(`GME ${zona} HTTP ${status}`);
  const arr = JSON.parse(body);
  if (!Array.isArray(arr)) throw new Error(`GME ${zona} non array`);
  return arr.map((r) => GmeRowSchema.parse(r));
}

async function fetchSeriesWithRetry(
  session: GmeDnnSession,
  zona: "PUN" | Zone,
  dataCompact: string,
): Promise<GmeRow[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetchSeries(session, zona, dataCompact);
    } catch (err) {
      lastErr = err;
      if (attempt < 2) {
        const backoffMs = 500 * Math.pow(2, attempt);
        await sleep(backoffMs);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY richieste in .env.local",
    );
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const SESSION_REFRESH_MS = 15 * 60 * 1000; // 15 min
  let session = await bootstrapGmeDnnSession(PAGE_URL);
  let sessionStartTime = Date.now();
  console.log("DNN session ok", { tabId: session.tabId });

  const slugMap: Record<Zone | "NATIONAL", string> = {
    NATIONAL: "pun",
    NORD: "pun-zona-nord",
    CNOR: "pun-zona-cnor",
    CSUD: "pun-zona-csud",
    SUD: "pun-zona-sud",
    SICI: "pun-zona-sici",
    SARD: "pun-zona-sard",
  };
  const slugs = Object.values(slugMap);
  const { data: assets, error: assetErr } = await db
    .from("assets")
    .select("id, slug")
    .in("slug", slugs);
  if (assetErr || !assets) {
    throw new Error(`fetch assets: ${assetErr?.message ?? "no rows"}`);
  }
  const slugToId = new Map(
    assets.map((a) => [a.slug as string, a.id as number]),
  );

  const end = addDaysIso(todayIso(), -1);
  let date = START_DATE;
  let totalRows = 0;
  let totalDays = 0;
  let emptyDays = 0;
  let errorDays = 0;
  const t0 = Date.now();

  console.log("backfill start", { from: START_DATE, to: end });

  while (date <= end) {
    try {
      if (Date.now() - sessionStartTime > SESSION_REFRESH_MS) {
        session = await bootstrapGmeDnnSession(PAGE_URL);
        sessionStartTime = Date.now();
        console.log(`[${date}] DNN session refreshed`);
      }
      const punRows = await fetchSeriesWithRetry(
        session,
        "PUN",
        compactDate(date),
      );
      await sleep(SLEEP_MS);
      if (punRows.length === 0) {
        emptyDays++;
        date = addDaysIso(date, 1);
        continue;
      }
      const zoneRows: Record<string, GmeRow[]> = {};
      for (const z of ZONES) {
        zoneRows[z] = await fetchSeriesWithRetry(
          session,
          z,
          compactDate(date),
        );
        await sleep(SLEEP_MS);
      }
      const combined = {
        source: "gme-mgp-pun" as const,
        url_base: GME_BASE,
        fetched_at: new Date().toISOString(),
        data_date: date,
        pun: punRows,
        zones: zoneRows,
      };
      const parsed = parseGmePun(JSON.stringify(combined));

      const rows: Array<{
        asset_id: number;
        observed_at: string;
        value: number;
        granularity: string;
        extra: Record<string, unknown>;
      }> = [];
      for (const p of parsed.pun_national) {
        const id = slugToId.get("pun");
        if (id) {
          rows.push({
            asset_id: id,
            observed_at: hourToIso(date, p.hour),
            value: p.value,
            granularity: "hourly",
            extra: { source_hour: p.hour, backfill: true },
          });
        }
      }
      for (const z of ZONES) {
        const id = slugToId.get(slugMap[z]);
        for (const p of parsed.zonal[z] ?? []) {
          if (id) {
            rows.push({
              asset_id: id,
              observed_at: hourToIso(date, p.hour),
              value: p.value,
              granularity: "hourly",
              extra: { source_hour: p.hour, zone: z, backfill: true },
            });
          }
        }
      }

      const { error } = await db
        .from("price_observations")
        .upsert(rows, { onConflict: "asset_id,observed_at" });
      if (error) throw new Error(`upsert ${date}: ${error.message}`);

      totalRows += rows.length;
      totalDays++;

      if (totalDays % PROGRESS_EVERY_DAYS === 0) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(
          `[${date}] +${rows.length} rows | total ${totalRows} rows / ${totalDays}d in ${elapsed}s | empty ${emptyDays} | err ${errorDays}`,
        );
      }
    } catch (err) {
      errorDays++;
      console.error(`[${date}] errore: ${(err as Error).message}`);
    }
    date = addDaysIso(date, 1);
  }

  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(0);
  console.log("DONE", {
    totalRows,
    totalDays,
    emptyDays,
    errorDays,
    elapsedSec,
  });

  // Refresh MV
  const { error: refreshErr } = await db.rpc("refresh_mv_latest_price_per_asset");
  if (refreshErr) console.warn("refresh MV warning:", refreshErr.message);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
