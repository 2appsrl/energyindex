import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { EidxProHeader } from "@/components/pro/EidxProHeader";
import { TradingDashboardView } from "@/components/pro/TradingDashboardView";
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
  title: "EIDX Trading Desk",
  description:
    "Dashboard purpose-built per trader energy italiani: Spark Spread, cross spreads, ATR, correlation matrix, posizioni + VaR + stress test.",
  robots: { index: false },
};

type Tab = "vitals" | "risk" | "backtest" | "alert";

export default async function TradingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const allowedTabs: Tab[] = ["vitals", "risk", "backtest", "alert"];
  const tab: Tab = allowedTabs.includes(tabParam as Tab) ? (tabParam as Tab) : "vitals";

  const supabase = await createServerClient();

  // ===== VITALS DATA =====
  const { data: latestData } = await supabase
    .from("mv_latest_price_per_asset")
    .select("asset_id, asset_slug, value")
    .in("asset_slug", ["pun", "psv", "ttf", "brent", "co2"]);
  const metaBySlug = new Map<string, { id: number; latest: number }>();
  for (const r of (latestData ?? []) as Array<{
    asset_id: number;
    asset_slug: string;
    value: number | string | null;
  }>) {
    metaBySlug.set(r.asset_slug, {
      id: Number(r.asset_id),
      latest: r.value === null ? 0 : Number(r.value),
    });
  }
  const pun = metaBySlug.get("pun")?.latest ?? 100;
  const psv = metaBySlug.get("psv")?.latest ?? 30;
  const ttf = metaBySlug.get("ttf")?.latest ?? 30;
  const co2 = metaBySlug.get("co2")?.latest ?? 70;
  const brent = metaBySlug.get("brent")?.latest ?? 80;

  async function loadSeries(slug: string, interval: string) {
    const m = metaBySlug.get(slug);
    if (!m) return [];
    const { data } = await supabase.rpc("get_price_series", {
      p_asset_id: m.id,
      p_interval: interval,
      p_bucket: "day",
    });
    return ((data ?? []) as Array<{ observed_at: string; value: number | string }>).map((r) => ({
      date: String(r.observed_at).slice(0, 10),
      value: Number(r.value),
    }));
  }

  const [punSeries, psvSeries, ttfSeries, brentSeries, co2Series] = await Promise.all([
    loadSeries("pun", "1 year"),
    loadSeries("psv", "1 year"),
    loadSeries("ttf", "1 year"),
    loadSeries("brent", "1 year"),
    loadSeries("co2", "1 year"),
  ]);

  // Spark spread storico + percentili
  const sparkMap = new Map<string, number>();
  const punByDate = new Map(punSeries.map((p) => [p.date, p.value]));
  const psvByDate = new Map(psvSeries.map((p) => [p.date, p.value]));
  const co2ByDate = new Map(co2Series.map((p) => [p.date, p.value]));
  for (const [date, p] of punByDate) {
    const ps = psvByDate.get(date);
    const co = co2ByDate.get(date);
    if (ps !== undefined && co !== undefined) {
      sparkMap.set(
        date,
        computeSparkSpread({ punEurPerMwh: p, psvEurPerMwh: ps, co2EurPerTon: co }),
      );
    }
  }
  const sparkSeries = [...sparkMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));
  const sparkLatest = computeSparkSpread({
    punEurPerMwh: pun,
    psvEurPerMwh: psv,
    co2EurPerTon: co2,
  });
  const sparkPercentiles = computePercentiles(sparkSeries.map((p) => p.value));

  // Cross spreads
  const punPsvSeries: Array<{ date: string; value: number }> = [];
  for (const [date, p] of punByDate) {
    const ps = psvByDate.get(date);
    if (ps !== undefined) punPsvSeries.push({ date, value: computePunPsvCrossSpread(p, ps) });
  }
  punPsvSeries.sort((a, b) => a.date.localeCompare(b.date));

  const ttfByDate = new Map(ttfSeries.map((p) => [p.date, p.value]));
  const psvTtfSeries: Array<{ date: string; value: number }> = [];
  for (const [date, ps] of psvByDate) {
    const t = ttfByDate.get(date);
    if (t !== undefined) psvTtfSeries.push({ date, value: computePsvTtfPremium(ps, t) });
  }
  psvTtfSeries.sort((a, b) => a.date.localeCompare(b.date));

  // ATR
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
  function lastNonNull(arr: (number | null)[]): number | null {
    for (let i = arr.length - 1; i >= 0; i--) {
      const v = arr[i];
      if (v !== null && Number.isFinite(v)) return v;
    }
    return null;
  }
  const atrLatest = {
    pun: lastNonNull(atrPun) ?? null,
    psv: lastNonNull(atrPsv) ?? null,
    ttf: lastNonNull(atrTtf) ?? null,
    brent: lastNonNull(atrBrent) ?? null,
    co2: lastNonNull(atrCo2) ?? null,
  };

  const corrMatrix = computeCorrelationMatrix(
    { pun: punSeries, psv: psvSeries, ttf: ttfSeries, brent: brentSeries, co2: co2Series },
    30,
  );

  // ===== RISK DATA =====
  const horizons = [7, 30, 90, 180] as const;
  const forecastsByHorizon: Record<number, { pun: number; psv: number; ttf: number }> = {};
  for (const h of horizons) {
    const { data } = await supabase.rpc("get_forecast_latest", {
      p_asset_slugs: ["pun", "psv", "ttf"],
      p_horizon_days: h,
    });
    const rows = (data ?? []) as Array<{ asset_slug: string; value: number | string }>;
    forecastsByHorizon[h] = {
      pun: Number(rows.find((r) => r.asset_slug === "pun")?.value ?? pun),
      psv: Number(rows.find((r) => r.asset_slug === "psv")?.value ?? psv),
      ttf: Number(rows.find((r) => r.asset_slug === "ttf")?.value ?? ttf),
    };
  }
  const atrPct = {
    pun: pun > 0 && atrLatest.pun !== null ? atrLatest.pun / pun : 0.04,
    psv: psv > 0 && atrLatest.psv !== null ? atrLatest.psv / psv : 0.04,
    ttf: ttf > 0 && atrLatest.ttf !== null ? atrLatest.ttf / ttf : 0.04,
  };

  return (
    <>
      <EidxProHeader section="Trading Desk" />
      <TradingDashboardView
        activeTab={tab}
        vitals={{
          spot: { pun, psv, ttf, brent, co2 },
          spark: {
            current: sparkLatest,
            percentiles: sparkPercentiles,
            series: sparkSeries.slice(-180),
          },
          crossSpreads: {
            punPsv: {
              current: computePunPsvCrossSpread(pun, psv),
              series: punPsvSeries.slice(-180),
            },
            psvTtf: {
              current: computePsvTtfPremium(psv, ttf),
              series: psvTtfSeries.slice(-180),
            },
          },
          atr: atrLatest,
          correlation: corrMatrix,
        }}
        risk={{
          forecastsByHorizon,
          atrPct,
          spot: { pun, psv, ttf },
        }}
      />
    </>
  );
}
