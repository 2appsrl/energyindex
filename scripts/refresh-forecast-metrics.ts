/**
 * Daily refresh delle metriche di track record.
 *
 * Per ogni (asset, horizon), prende tutti i forecast con forecast_date <= today
 * emessi nel periodo target (ultimi 90g e ultimi 365g), li accoppia con il
 * valore reale di forecast_date, e calcola MAPE/RMSE/hit_ratio/coverage.
 *
 * Upsert su forecast_metrics con (asset_id, horizon_days, period_start, period_end).
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TARGET_SLUGS = ["pun", "psv", "ttf"] as const;
const HORIZONS = [7, 30, 90, 180] as const;
const WINDOWS_DAYS = [90, 365] as const;

export interface ForecastVsReal {
  real: number;
  predicted: number;
  lower: number;
  upper: number;
  prev_real: number;
}

export interface MetricsResult {
  mape: number | null;
  rmse: number | null;
  hit_ratio: number | null;
  coverage: number | null;
  n_observations: number;
}

export function computeMetrics(pairs: ForecastVsReal[]): MetricsResult {
  if (pairs.length === 0)
    return { mape: null, rmse: null, hit_ratio: null, coverage: null, n_observations: 0 };
  let sumPct = 0, countPct = 0;
  let sumSq = 0;
  let hits = 0;
  let covered = 0;
  for (const p of pairs) {
    if (p.real !== 0) { sumPct += Math.abs((p.predicted - p.real) / p.real); countPct++; }
    sumSq += (p.predicted - p.real) ** 2;
    const predUp = p.predicted >= p.prev_real;
    const realUp = p.real >= p.prev_real;
    if (predUp === realUp && p.predicted !== p.prev_real) hits++;
    if (p.real >= p.lower && p.real <= p.upper) covered++;
  }
  return {
    mape: countPct > 0 ? (sumPct / countPct) * 100 : null,
    rmse: Math.sqrt(sumSq / pairs.length),
    hit_ratio: hits / pairs.length,
    coverage: covered / pairs.length,
    n_observations: pairs.length,
  };
}

function supabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Env vars mancanti");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function loadPairs(
  supabase: SupabaseClient,
  assetId: number,
  horizon: number,
  windowDays: number,
): Promise<ForecastVsReal[]> {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);

  const { data: fcRows, error: fcErr } = await supabase
    .from("forecasts")
    .select("forecast_date, value, value_lower, value_upper")
    .eq("asset_id", assetId)
    .eq("horizon_days", horizon)
    .gte("generated_at", windowStart.toISOString())
    .lte("forecast_date", now.toISOString().slice(0, 10));
  if (fcErr) throw new Error(`loadPairs fc: ${fcErr.message}`);
  if (!fcRows || fcRows.length === 0) return [];

  const dates = [...new Set(fcRows.map((r) => r.forecast_date as string))];
  const prevDates = dates.map((d) => {
    const dd = new Date(d + "T12:00:00Z");
    dd.setUTCDate(dd.getUTCDate() - 1);
    return dd.toISOString().slice(0, 10);
  });
  const allDates = [...new Set([...dates, ...prevDates])];
  const minDate = allDates.reduce((a, b) => (a < b ? a : b));
  const maxDate = allDates.reduce((a, b) => (a > b ? a : b));
  const { data: realRows, error: realErr } = await supabase
    .from("price_observations")
    .select("observed_at, value")
    .eq("asset_id", assetId)
    .gte("observed_at", `${minDate}T00:00:00Z`)
    .lte("observed_at", `${maxDate}T23:59:59Z`)
    .order("observed_at", { ascending: true });
  if (realErr) throw new Error(`loadPairs real: ${realErr.message}`);

  const realByDay = new Map<string, number[]>();
  for (const r of realRows ?? []) {
    const d = new Date(r.observed_at as string);
    const dk = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
    const list = realByDay.get(dk) ?? [];
    list.push(Number(r.value));
    realByDay.set(dk, list);
  }
  const meanOf = (dk: string): number | null => {
    const arr = realByDay.get(dk);
    if (!arr || arr.length === 0) return null;
    return arr.reduce((s,v)=>s+v,0) / arr.length;
  };

  const pairs: ForecastVsReal[] = [];
  for (const fc of fcRows) {
    const real = meanOf(fc.forecast_date as string);
    if (real === null) continue;
    const prev = new Date((fc.forecast_date as string) + "T12:00:00Z");
    prev.setUTCDate(prev.getUTCDate() - 1);
    const prevKey = prev.toISOString().slice(0,10);
    const prevReal = meanOf(prevKey);
    if (prevReal === null) continue;
    pairs.push({
      real,
      predicted: Number(fc.value),
      lower: Number(fc.value_lower ?? fc.value),
      upper: Number(fc.value_upper ?? fc.value),
      prev_real: prevReal,
    });
  }
  return pairs;
}

export async function refreshMetrics(now: Date = new Date()): Promise<{
  upserted: number;
  errors: number;
}> {
  const supabase = supabaseClient();
  let upserted = 0;
  let errors = 0;

  for (const slug of TARGET_SLUGS) {
    const { data: a } = await supabase.from("assets").select("id").eq("slug", slug).maybeSingle();
    if (!a) continue;
    const assetId = Number(a.id);

    for (const horizon of HORIZONS) {
      for (const windowDays of WINDOWS_DAYS) {
        try {
          const pairs = await loadPairs(supabase, assetId, horizon, windowDays);
          const m = computeMetrics(pairs);
          const periodEnd = now.toISOString().slice(0, 10);
          const periodStart = new Date(now);
          periodStart.setUTCDate(periodStart.getUTCDate() - windowDays);
          const { error } = await supabase.from("forecast_metrics").upsert({
            asset_id: assetId,
            horizon_days: horizon,
            period_start: periodStart.toISOString().slice(0, 10),
            period_end: periodEnd,
            mape: m.mape,
            rmse: m.rmse,
            hit_ratio: m.hit_ratio,
            coverage: m.coverage,
            n_observations: m.n_observations,
            computed_at: now.toISOString(),
          }, { onConflict: "asset_id,horizon_days,period_start,period_end" });
          if (error) { errors++; console.error(`upsert ${slug} h=${horizon} w=${windowDays}: ${error.message}`); }
          else { upserted++; console.log(`[metrics] ${slug} h=${horizon} w=${windowDays} mape=${m.mape?.toFixed(2)}% n=${m.n_observations}`); }
        } catch (err) {
          errors++;
          console.error(`compute ${slug} h=${horizon} w=${windowDays}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  }
  return { upserted, errors };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void (async () => {
    const r = await refreshMetrics();
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.errors === 0 ? 0 : 1);
  })();
}
