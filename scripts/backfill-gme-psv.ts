/**
 * One-shot backfill PSV dall'archivio GME-MGP-GAS.
 *
 * Itera da START_DATE a ieri, fetcha 1 sessione di trading per giorno,
 * estrae il prezzo PSV per la consegna del giorno successivo (T+1) via
 * parseGmePsv, upsert in price_observations. Idempotente.
 *
 * Eseguibile localmente: npm run backfill:gme-psv
 * Richiede in .env.local: SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) +
 * SUPABASE_SERVICE_ROLE_KEY.
 *
 * Override via env: BACKFILL_START, BACKFILL_END, BACKFILL_SLEEP_MS.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import {
  bootstrapGmeDnnSession,
  gmeApiGet,
  GME_BASE,
  type GmeDnnSession,
} from "../supabase/functions/_shared/gme-dnn.js";
import { parseGmePsv } from "../supabase/functions/_shared/parsers/gme-psv.js";

const PAGE_PATH = "/it-it/Home/Esiti/Gas/MGP/Esiti";
const PAGE_URL = GME_BASE + PAGE_PATH;
const API_PATH = "/DesktopModules/GmeEsitiMGAS/API/item/GetGasEsitiMGAS";

// 5 anni fino a ieri. Override via env.
const START_DATE = process.env.BACKFILL_START ?? "2021-05-11";
const END_DATE_OVERRIDE = process.env.BACKFILL_END ?? null;
const SLEEP_MS = Number(process.env.BACKFILL_SLEEP_MS ?? 500);
const PROGRESS_EVERY_DAYS = 60;
const SESSION_REFRESH_MS = 15 * 60 * 1000;
const REBOOTSTRAP_AFTER_ERRORS = 3;
const REBOOTSTRAP_PAUSE_MS = 30 * 1000;

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

async function fetchSessionRaw(
  session: GmeDnnSession,
  sessionDate: string,
): Promise<unknown[]> {
  const { status, body } = await gmeApiGet(session, API_PATH, {
    DataSessione: compactDate(sessionDate),
    Mercato: "MGP",
  });
  if (status !== 200) throw new Error(`GME HTTP ${status}`);
  const arr = JSON.parse(body);
  if (!Array.isArray(arr)) throw new Error("GME non array");
  return arr;
}

async function fetchSessionWithRetry(
  session: GmeDnnSession,
  sessionDate: string,
): Promise<unknown[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fetchSessionRaw(session, sessionDate);
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
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY richieste in .env.local",
    );
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  let session = await bootstrapGmeDnnSession(PAGE_URL);
  let sessionStartTime = Date.now();
  console.log("DNN session ok", { tabId: session.tabId });

  const { data: asset, error: assetErr } = await db
    .from("assets")
    .select("id")
    .eq("slug", "psv")
    .single();
  if (assetErr || !asset) {
    throw new Error(`asset psv non seedato: ${assetErr?.message ?? "no row"}`);
  }
  const assetId = asset.id as number;

  const end = END_DATE_OVERRIDE ?? addDaysIso(todayIso(), -1);
  let date = START_DATE;
  let totalRows = 0;
  let totalDays = 0;
  let emptyDays = 0;
  let errorDays = 0;
  let consecutiveErrors = 0;
  const t0 = Date.now();

  console.log("backfill start", {
    from: START_DATE,
    to: end,
    sleepMs: SLEEP_MS,
  });

  while (date <= end) {
    try {
      if (consecutiveErrors >= REBOOTSTRAP_AFTER_ERRORS) {
        console.warn(
          `[${date}] ${consecutiveErrors} errori consecutivi: pausa + re-bootstrap`,
        );
        await sleep(REBOOTSTRAP_PAUSE_MS);
        session = await bootstrapGmeDnnSession(PAGE_URL);
        sessionStartTime = Date.now();
        consecutiveErrors = 0;
        console.log(`[${date}] DNN session re-bootstrapped`);
      } else if (Date.now() - sessionStartTime > SESSION_REFRESH_MS) {
        session = await bootstrapGmeDnnSession(PAGE_URL);
        sessionStartTime = Date.now();
        console.log(`[${date}] DNN session refreshed (15min)`);
      }

      const rows = await fetchSessionWithRetry(session, date);
      await sleep(SLEEP_MS);

      if (rows.length === 0) {
        emptyDays++;
        date = addDaysIso(date, 1);
        continue;
      }

      const combined = {
        source: "gme-mgp-gas-psv" as const,
        url_base: GME_BASE,
        fetched_at: new Date().toISOString(),
        sessions: [
          {
            session_date: date,
            http_status: 200,
            rows,
          },
        ],
      };
      const parsed = parseGmePsv(JSON.stringify(combined));

      if (parsed.points.length === 0) {
        emptyDays++;
        date = addDaysIso(date, 1);
        continue;
      }

      const dbRows = parsed.points.map((p) => ({
        asset_id: assetId,
        observed_at: `${p.date}T00:00:00+01:00`,
        value: p.value,
        granularity: "daily",
        extra: { session_date: date, backfill: true },
      }));

      const { error } = await db
        .from("price_observations")
        .upsert(dbRows, { onConflict: "asset_id,observed_at" });
      if (error) throw new Error(`upsert ${date}: ${error.message}`);

      totalRows += dbRows.length;
      totalDays++;
      consecutiveErrors = 0;

      if (totalDays % PROGRESS_EVERY_DAYS === 0) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(
          `[${date}] +${dbRows.length} | total ${totalRows} / ${totalDays}d in ${elapsed}s | empty ${emptyDays} | err ${errorDays}`,
        );
      }
    } catch (err) {
      errorDays++;
      consecutiveErrors++;
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
