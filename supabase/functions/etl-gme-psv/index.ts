/**
 * Edge Function `etl-gme-psv` — Slice 2.
 *
 * 1) Bootstrap DNN session sulla pagina contenitore MGP-GAS.
 * 2) Fetch sessione di trading oggi (T) -> 1 punto PSV per consegna T+1.
 *    Fallback: se oggi è vuoto (asta non ancora chiusa), prova ieri -> consegna oggi.
 * 3) Parse via parseGmePsv (single source of truth shared con i test).
 * 4) UPSERT 1 riga in price_observations (granularity='daily').
 * 5) Refresh MV mv_latest_price_per_asset.
 *
 * Invocata da pg_cron alle 18:00 Europe/Rome, dopo chiusura MGP-GAS ~17:00.
 * Niente auth utente: --no-verify-jwt al deploy.
 */
import { runEtl } from "../_shared/etl-runner.ts";
import {
  bootstrapGmeDnnSession,
  gmeApiGet,
  GME_BASE,
  type GmeDnnSession,
} from "../_shared/gme-dnn.ts";
import { parseGmePsv } from "../_shared/parsers/gme-psv.ts";
import { dbServiceRole, refreshLatestPriceView } from "../_shared/db.ts";

const PAGE_PATH = "/it-it/Home/Esiti/Gas/MGP/Esiti";
const PAGE_URL = GME_BASE + PAGE_PATH;
const API_PATH = "/DesktopModules/GmeEsitiMGAS/API/item/GetGasEsitiMGAS";

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

async function fetchSessionRaw(
  session: GmeDnnSession,
  sessionDate: string,
): Promise<{ http_status: number; session_date: string; rows: unknown[] }> {
  const { status, body } = await gmeApiGet(session, API_PATH, {
    DataSessione: compactDate(sessionDate),
    Mercato: "MGP",
  });
  if (status !== 200) {
    return { http_status: status, session_date: sessionDate, rows: [] };
  }
  const arr = JSON.parse(body);
  return {
    http_status: 200,
    session_date: sessionDate,
    rows: Array.isArray(arr) ? arr : [],
  };
}

Deno.serve(async () => {
  return runEtl("gme-psv", async (ctx) => {
    const session = await bootstrapGmeDnnSession(PAGE_URL);
    ctx.log("dnn session ok", { tabId: session.tabId });

    // Sessione di oggi -> prezzo consegna domani.
    // Se asta ancora non chiusa (rows=[]) fallback a sessione di ieri -> consegna oggi.
    const today = isoDateInRome();
    let sessionData = await fetchSessionRaw(session, today);
    if (sessionData.rows.length === 0) {
      const yesterday = addDaysIso(today, -1);
      ctx.log("today empty, fallback yesterday", { from: today, to: yesterday });
      sessionData = await fetchSessionRaw(session, yesterday);
    }

    const combined = {
      source: "gme-mgp-gas-psv" as const,
      url_base: GME_BASE,
      fetched_at: new Date().toISOString(),
      sessions: [sessionData],
    };
    const parsed = parseGmePsv(JSON.stringify(combined));

    if (parsed.points.length === 0) {
      ctx.log("no PSV points (sessione vuota)", {});
      return {
        rows_ingested: 0,
        metadata: { session_date: sessionData.session_date },
      };
    }

    const db = dbServiceRole();
    const { data: asset, error: assetErr } = await db
      .from("assets")
      .select("id")
      .eq("slug", "psv")
      .single();
    if (assetErr || !asset) {
      throw new Error(`asset psv non seedato: ${assetErr?.message ?? "no row"}`);
    }

    const rows = parsed.points.map((p) => ({
      asset_id: asset.id,
      // observed_at = midnight Europe/Rome del giorno di consegna.
      // CET fisso (+01:00) per coerenza con la simplification del PUN ETL.
      observed_at: `${p.date}T00:00:00+01:00`,
      value: p.value,
      granularity: "daily",
      extra: { session_date: sessionData.session_date },
    }));

    const { error: upsertErr } = await db
      .from("price_observations")
      .upsert(rows, { onConflict: "asset_id,observed_at" });
    if (upsertErr) throw new Error(`upsert: ${upsertErr.message}`);
    ctx.log("upserted", { rows: rows.length });

    await refreshLatestPriceView(db);
    ctx.log("mv refreshed");

    return {
      rows_ingested: rows.length,
      metadata: { session_date: sessionData.session_date },
    };
  });
});
