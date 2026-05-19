import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { EidxProHeader } from "@/components/pro/EidxProHeader";
import { TradingVitalsView } from "@/components/pro/TradingVitalsView";
import {
  computeSparkSpread,
  computePercentiles,
  computeAtr,
  computeCorrelationMatrix,
  computePunPsvCrossSpread,
  computePsvTtfPremium,
} from "@/lib/pro/trading-math";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trading Vitals — EIDX Pro",
  description:
    "Spark spread italiano, cross spreads, ATR e correlation matrix per trader energy. Demo gratuita pre-launch.",
  robots: { index: false },
};

interface AssetMeta {
  slug: string;
  id: number;
  latest: number | null;
}

export default async function TradingVitalsPage() {
  const supabase = await createServerClient();

  // 1. Asset ids + spot latest (da mv_latest_price_per_asset)
  const { data: latestData } = await supabase
    .from("mv_latest_price_per_asset")
    .select("asset_id, asset_slug, value")
    .in("asset_slug", ["pun", "psv", "ttf", "brent", "co2"]);
  const metaBySlug = new Map<string, AssetMeta>();
  for (const r of (latestData ?? []) as Array<{
    asset_id: number;
    asset_slug: string;
    value: number | string | null;
  }>) {
    metaBySlug.set(r.asset_slug, {
      slug: r.asset_slug,
      id: Number(r.asset_id),
      latest: r.value === null ? null : Number(r.value),
    });
  }

  const pun = metaBySlug.get("pun")?.latest ?? 100;
  const psv = metaBySlug.get("psv")?.latest ?? 30;
  const ttf = metaBySlug.get("ttf")?.latest ?? 30;
  const co2 = metaBySlug.get("co2")?.latest ?? 70;
  const brent = metaBySlug.get("brent")?.latest ?? 80;

  // 2. Storico daily 1 anno per ogni asset via get_price_series
  async function loadSeries(slug: string): Promise<Array<{ date: string; value: number }>> {
    const m = metaBySlug.get(slug);
    if (!m) return [];
    const { data } = await supabase.rpc("get_price_series", {
      p_asset_id: m.id,
      p_interval: "1 year",
      p_bucket: "day",
    });
    return ((data ?? []) as Array<{ observed_at: string; value: number | string }>).map((r) => ({
      date: String(r.observed_at).slice(0, 10),
      value: Number(r.value),
    }));
  }

  const [punSeries, psvSeries, ttfSeries, brentSeries, co2Series] = await Promise.all([
    loadSeries("pun"),
    loadSeries("psv"),
    loadSeries("ttf"),
    loadSeries("brent"),
    loadSeries("co2"),
  ]);

  // 3. Calcola spark spread giornaliero (richiede tutti i 3 PUN/PSV/CO2 in stessa data)
  const sparkSeriesMap = new Map<string, number>();
  const punByDate = new Map(punSeries.map((p) => [p.date, p.value]));
  const psvByDate = new Map(psvSeries.map((p) => [p.date, p.value]));
  const co2ByDate = new Map(co2Series.map((p) => [p.date, p.value]));
  for (const [date, punV] of punByDate) {
    const psvV = psvByDate.get(date);
    const co2V = co2ByDate.get(date);
    if (psvV !== undefined && co2V !== undefined) {
      sparkSeriesMap.set(
        date,
        computeSparkSpread({ punEurPerMwh: punV, psvEurPerMwh: psvV, co2EurPerTon: co2V }),
      );
    }
  }
  const sparkSeries = [...sparkSeriesMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));
  const sparkLatest = computeSparkSpread({
    punEurPerMwh: pun,
    psvEurPerMwh: psv,
    co2EurPerTon: co2,
  });
  const sparkPercentiles = computePercentiles(sparkSeries.map((p) => p.value));

  // 4. Cross spreads daily
  const punPsvSeries: Array<{ date: string; value: number }> = [];
  for (const [date, p] of punByDate) {
    const ps = psvByDate.get(date);
    if (ps !== undefined) punPsvSeries.push({ date, value: computePunPsvCrossSpread(p, ps) });
  }
  punPsvSeries.sort((a, b) => a.date.localeCompare(b.date));

  const ttfByDate = new Map(ttfSeries.map((p) => [p.date, p.value]));
  const psvTtfSeries: Array<{ date: string; value: number }> = [];
  for (const [date, ps] of psvByDate) {
    const tt = ttfByDate.get(date);
    if (tt !== undefined) psvTtfSeries.push({ date, value: computePsvTtfPremium(ps, tt) });
  }
  psvTtfSeries.sort((a, b) => a.date.localeCompare(b.date));

  // 5. ATR 14g per ogni asset (ultimo valore)
  const atrPun = computeAtr(
    punSeries.map((p) => p.value),
    14,
  );
  const atrPsv = computeAtr(
    psvSeries.map((p) => p.value),
    14,
  );
  const atrTtf = computeAtr(
    ttfSeries.map((p) => p.value),
    14,
  );
  const atrBrent = computeAtr(
    brentSeries.map((p) => p.value),
    14,
  );
  const atrCo2 = computeAtr(
    co2Series.map((p) => p.value),
    14,
  );

  function last<T>(arr: T[]): T | null {
    return arr.length > 0 ? arr[arr.length - 1] : null;
  }

  const atrLatest = {
    pun: last(atrPun) ?? null,
    psv: last(atrPsv) ?? null,
    ttf: last(atrTtf) ?? null,
    brent: last(atrBrent) ?? null,
    co2: last(atrCo2) ?? null,
  };

  // 6. Correlation matrix 30g
  const corrMatrix = computeCorrelationMatrix(
    { pun: punSeries, psv: psvSeries, ttf: ttfSeries, brent: brentSeries, co2: co2Series },
    30,
  );

  return (
    <>
      <EidxProHeader section="Trading Vitals" />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1 max-w-2xl">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Trading Vitals — Italia</h1>
          <p className="text-sm text-stone-600">
            Spark spread CCGT, cross spreads gas-power, volatility ATR e correlation matrix per il
            mercato elettrico italiano. Demo pubblica, dati live.
          </p>
        </header>

        <TradingVitalsView
          spot={{ pun, psv, ttf, brent, co2 }}
          spark={{
            current: sparkLatest,
            percentiles: sparkPercentiles,
            series: sparkSeries.slice(-180), // ultimi 6 mesi per chart
          }}
          crossSpreads={{
            punPsv: {
              current: computePunPsvCrossSpread(pun, psv),
              series: punPsvSeries.slice(-180),
            },
            psvTtf: {
              current: computePsvTtfPremium(psv, ttf),
              series: psvTtfSeries.slice(-180),
            },
          }}
          atr={atrLatest}
          correlation={corrMatrix}
        />

        <footer className="pt-6 border-t border-stone-200 text-xs text-stone-500 flex justify-between flex-wrap gap-2">
          <span>
            Spot live · ATR 14g · correlation 30g rolling su log-returns · sample 1 anno
          </span>
          <span className="text-stone-400">
            Wave 2 (Risk &amp; Hedging) e Wave 3 (Backtest + API): tier Trading 999€/mese
          </span>
        </footer>
      </div>
    </>
  );
}
