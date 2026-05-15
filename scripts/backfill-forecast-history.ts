/**
 * Backfill walk-forward: ricostruisce 12 mesi di forecast retrospettivi,
 * usando per ogni giorno d SOLO i dati disponibili al giorno d (no leakage).
 *
 * Output: ~365 giorni × 3 asset × 4 horizon = ~4.380 record in `forecasts`.
 * Tempo stimato: 8-15 minuti.
 *
 * Eseguire 1 volta manualmente dopo l'apply delle migrations:
 *   npx tsx scripts/backfill-forecast-history.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateForecastForAsset } from "@/lib/forecast/orchestrator";
import { sanitizeSeries } from "./run-forecast-daily";
import { alignDriverToTarget, type SeriesPoint } from "@/lib/forecast/features";

const TARGET_SLUGS = ["pun", "psv", "ttf"] as const;
const HORIZONS = [7, 30, 90, 180] as const;
const DRIVER_SLUGS_PER_TARGET: Record<string, string[]> = {
  pun: ["ttf", "brent", "co2", "temperatura-it"],
  psv: ["ttf", "brent", "co2", "temperatura-it"],
  ttf: ["brent", "co2", "psv"],
};
const DRIVER_KEY_MAP: Record<string, string> = {
  ttf: "ttf",
  brent: "brent",
  co2: "co2",
  "temperatura-it": "temperature",
  psv: "psv",
};
const BACKFILL_DAYS = 365;
const TRAIN_YEARS = 5;
const BATCH_SIZE = 100;

function supabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Env vars mancanti");
  return createClient(url, key, { auth: { persistSession: false } });
}

interface RawObs { observed_at: string; value: number | string; }

async function loadFull(sb: SupabaseClient, assetId: number): Promise<RawObs[]> {
  const collected: RawObs[] = [];
  let offset = 0;
  const PAGE = 1000;
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - (TRAIN_YEARS + 2));
  while (true) {
    const { data, error } = await sb
      .from("price_observations")
      .select("observed_at, value")
      .eq("asset_id", assetId)
      .gte("observed_at", cutoff.toISOString())
      .order("observed_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    collected.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return collected;
}

function filterUpTo(series: SeriesPoint[], cutoff: Date): SeriesPoint[] {
  // Strict <: per il giorno d usiamo solo dati osservati < d 00:00 UTC
  const limit = Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), cutoff.getUTCDate(), 0);
  return series.filter((p) => p.date.getTime() < limit);
}

async function run(): Promise<{ generated: number; skipped: number; errors: number }> {
  const sb = supabase();
  let generated = 0, skipped = 0, errors = 0;

  const allSlugs = new Set<string>();
  for (const t of TARGET_SLUGS) {
    allSlugs.add(t);
    for (const d of DRIVER_SLUGS_PER_TARGET[t]) allSlugs.add(d);
  }
  const assetIds = new Map<string, number>();
  const fullSeries = new Map<string, SeriesPoint[]>();
  for (const slug of allSlugs) {
    const { data: a } = await sb.from("assets").select("id").eq("slug", slug).maybeSingle();
    if (!a) continue;
    assetIds.set(slug, Number(a.id));
    const raw = await loadFull(sb, Number(a.id));
    fullSeries.set(slug, sanitizeSeries(raw));
    console.log(`[backfill] preloaded ${slug}: ${fullSeries.get(slug)?.length} points`);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let pending: Array<Record<string, unknown>> = [];

  for (let dayOffset = BACKFILL_DAYS; dayOffset > 0; dayOffset--) {
    const simulatedNow = new Date(today);
    simulatedNow.setUTCDate(simulatedNow.getUTCDate() - dayOffset);
    simulatedNow.setUTCHours(5, 0, 0, 0);

    for (const targetSlug of TARGET_SLUGS) {
      const targetId = assetIds.get(targetSlug);
      const fullT = fullSeries.get(targetSlug);
      if (!targetId || !fullT) continue;
      const target = filterUpTo(fullT, simulatedNow);

      const drivers: Record<string, SeriesPoint[]> = {};
      for (const dSlug of DRIVER_SLUGS_PER_TARGET[targetSlug]) {
        const ds = fullSeries.get(dSlug);
        if (!ds) continue;
        const filtered = filterUpTo(ds, simulatedNow);
        if (filtered.length === 0) continue;
        drivers[DRIVER_KEY_MAP[dSlug]] = alignDriverToTarget(target, filtered);
      }

      for (const horizon of HORIZONS) {
        try {
          const fc = generateForecastForAsset({
            assetSlug: targetSlug,
            horizonDays: horizon,
            target,
            drivers,
            generatedAt: simulatedNow,
          });
          if (!fc) { skipped++; continue; }
          pending.push({
            asset_id: targetId,
            forecast_date: fc.forecast_date,
            generated_at: fc.generated_at,
            horizon_days: fc.horizon_days,
            value: fc.value,
            value_lower: fc.value_lower,
            value_upper: fc.value_upper,
            drivers: fc.drivers,
            model_version: fc.model_version,
          });
          generated++;
        } catch (err) {
          errors++;
          console.error(`d=${simulatedNow.toISOString().slice(0,10)} ${targetSlug} h=${horizon}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    if (pending.length >= BATCH_SIZE) {
      const { error } = await sb.from("forecasts").upsert(pending, { onConflict: "asset_id,forecast_date,generated_at,horizon_days" });
      if (error) console.error(`flush ${pending.length}: ${error.message}`);
      pending = [];
      console.log(`[backfill] day=${simulatedNow.toISOString().slice(0,10)} flushed (total gen=${generated} skip=${skipped} err=${errors})`);
    }
  }
  if (pending.length > 0) {
    const { error } = await sb.from("forecasts").upsert(pending, { onConflict: "asset_id,forecast_date,generated_at,horizon_days" });
    if (error) console.error(`final flush: ${error.message}`);
  }
  return { generated, skipped, errors };
}

void (async () => {
  const r = await run();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.errors === 0 ? 0 : 1);
})();
