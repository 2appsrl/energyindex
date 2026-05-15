/**
 * Daily forecast inference job.
 *
 * Per ogni asset target (PUN/PSV/TTF), per ogni horizon (7/30/90/180):
 *   1. Carica serie target + driver dagli ultimi N anni
 *   2. Genera forecast via generateForecastForAsset()
 *   3. Upsert in tabella forecasts
 *
 * Eseguito da GitHub Actions cron "0 5 * * *" (05:00 UTC).
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateForecastForAsset, type ForecastOutput } from "@/lib/forecast/orchestrator";
import { alignDriverToTarget, type SeriesPoint } from "@/lib/forecast/features";

const TARGET_SLUGS = ["pun", "psv", "ttf"] as const;
const HORIZONS = [7, 30, 90, 180] as const;
const DRIVER_SLUGS_PER_TARGET: Record<string, string[]> = {
  pun: ["ttf", "brent", "co2", "temperatura-it"],
  psv: ["ttf", "brent", "co2", "temperatura-it"],
  ttf: ["brent", "co2", "psv"],
};

// Mappa slug DB driver -> chiave usata in orchestrator
const DRIVER_KEY_MAP: Record<string, string> = {
  ttf: "ttf",
  brent: "brent",
  co2: "co2",
  "temperatura-it": "temperature",
  psv: "psv",
};

interface RawObs {
  observed_at: string;
  value: number | string;
}

/**
 * Normalizza una lista di osservazioni a una serie giornaliera unica:
 * - parse value -> number
 * - aggrega per giorno UTC (media se ci sono piu' osservazioni / esempio PUN orario)
 * - normalizza date a mezzogiorno UTC
 * - ordina cronologicamente
 */
export function sanitizeSeries(rows: RawObs[]): SeriesPoint[] {
  const byDay = new Map<string, number[]>();
  for (const r of rows) {
    const d = new Date(r.observed_at);
    const dayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const v = Number(r.value);
    if (!Number.isFinite(v)) continue;
    const list = byDay.get(dayKey) ?? [];
    list.push(v);
    byDay.set(dayKey, list);
  }
  const out: SeriesPoint[] = [];
  for (const [dayKey, values] of byDay) {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    out.push({
      date: new Date(`${dayKey}T12:00:00Z`),
      value: mean,
    });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function supabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function loadAssetId(supabase: SupabaseClient, slug: string): Promise<number | null> {
  const { data } = await supabase.from("assets").select("id").eq("slug", slug).maybeSingle();
  return data ? Number(data.id) : null;
}

async function loadSeries(supabase: SupabaseClient, assetId: number, yearsBack: number): Promise<SeriesPoint[]> {
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - yearsBack);
  const PAGE_SIZE = 1000;
  const collected: RawObs[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("price_observations")
      .select("observed_at, value")
      .eq("asset_id", assetId)
      .gte("observed_at", cutoff.toISOString())
      .lte("observed_at", new Date().toISOString())
      .order("observed_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`loadSeries asset=${assetId}: ${error.message}`);
    if (!data || data.length === 0) break;
    collected.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return sanitizeSeries(collected);
}

async function saveForecast(
  supabase: SupabaseClient,
  assetId: number,
  fc: ForecastOutput,
): Promise<void> {
  const { error } = await supabase.from("forecasts").upsert(
    {
      asset_id: assetId,
      forecast_date: fc.forecast_date,
      generated_at: fc.generated_at,
      horizon_days: fc.horizon_days,
      value: fc.value,
      value_lower: fc.value_lower,
      value_upper: fc.value_upper,
      drivers: fc.drivers,
      model_version: fc.model_version,
    },
    { onConflict: "asset_id,forecast_date,generated_at,horizon_days" },
  );
  if (error) throw new Error(`saveForecast: ${error.message}`);
}

export async function runDailyForecast(now: Date = new Date()): Promise<{
  generated: number;
  skipped: number;
  errors: number;
}> {
  const supabase = supabaseClient();
  let generated = 0;
  let skipped = 0;
  let errors = 0;

  // Pre-load asset_id per tutti gli slug coinvolti
  const allSlugs = new Set<string>();
  for (const t of TARGET_SLUGS) {
    allSlugs.add(t);
    for (const d of DRIVER_SLUGS_PER_TARGET[t]) allSlugs.add(d);
  }
  const assetIds = new Map<string, number>();
  for (const slug of allSlugs) {
    const id = await loadAssetId(supabase, slug);
    if (id !== null) assetIds.set(slug, id);
  }

  for (const targetSlug of TARGET_SLUGS) {
    const targetId = assetIds.get(targetSlug);
    if (!targetId) {
      console.warn(`[forecast-daily] asset '${targetSlug}' non trovato, skip`);
      continue;
    }
    const target = await loadSeries(supabase, targetId, 5);
    console.log(`[forecast-daily] target=${targetSlug} loaded ${target.length} points`);

    const drivers: Record<string, SeriesPoint[]> = {};
    for (const dSlug of DRIVER_SLUGS_PER_TARGET[targetSlug]) {
      const dId = assetIds.get(dSlug);
      if (!dId) continue;
      const series = await loadSeries(supabase, dId, 5);
      if (series.length === 0) continue;
      drivers[DRIVER_KEY_MAP[dSlug]] = alignDriverToTarget(target, series);
    }

    for (const horizon of HORIZONS) {
      try {
        const fc = generateForecastForAsset({
          assetSlug: targetSlug,
          horizonDays: horizon,
          target,
          drivers,
          generatedAt: now,
        });
        if (!fc) {
          skipped++;
          console.warn(`[forecast-daily] ${targetSlug} h=${horizon}: skip (insufficient data)`);
          continue;
        }
        await saveForecast(supabase, targetId, fc);
        generated++;
        console.log(`[forecast-daily] ${targetSlug} h=${horizon}: ${fc.value} (${fc.value_lower}-${fc.value_upper})`);
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[forecast-daily] ${targetSlug} h=${horizon} ERROR: ${msg}`);
      }
    }
  }

  return { generated, skipped, errors };
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void (async () => {
    const result = await runDailyForecast();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.errors === 0 ? 0 : 1);
  })();
}
