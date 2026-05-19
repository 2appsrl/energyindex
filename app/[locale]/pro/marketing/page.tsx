import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { EidxProHeader } from "@/components/pro/EidxProHeader";
import { MarketingDashboardView } from "@/components/pro/MarketingDashboardView";
import type { OfferRecord, ForecastAverages } from "@/lib/pro/customer-math";
import type { ForecastPoint } from "@/lib/pro/forecast-scenari-math";
import type { ReportSnapshot } from "@/components/pro/ReportBuilderView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "EIDX Marketing Desk",
  description:
    "Dashboard unificata per chi vende energia: margin simulator, customer simulator, forecast & scenari, report builder. Demo gratuita pre-launch.",
  robots: { index: false },
};

type Tab = "margin" | "customer" | "forecast" | "report" | "churn";

interface ForecastChartRow {
  date: string;
  source: string;
  value: number | string;
  value_lower: number | string | null;
  value_upper: number | string | null;
}

interface CompetitorRow {
  p25_eur_mwh: number | string;
  median_eur_mwh: number | string;
  p75_eur_mwh: number | string;
  n_offerte: number;
  source: string;
}

interface OfferRow {
  offer_code: string;
  supplier: string;
  supplier_logo_url: string | null;
  offer_name: string | null;
  commodity: string;
  price_type: string;
  price_value: number | string;
  fixed_cost_monthly: number | string | null;
  customer_segment: string;
  source_url: string | null;
  notes: string | null;
}

interface ForecastLatestRow {
  asset_slug: string;
  display_name_it: string;
  unit: string;
  value: number | string;
}

interface MetricsRow {
  asset_slug: string;
  horizon_days: number;
  mape: number | string | null;
  hit_ratio: number | string | null;
}

export default async function MarketingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const allowedTabs: Tab[] = ["margin", "customer", "forecast", "report", "churn"];
  const tab: Tab = allowedTabs.includes(tabParam as Tab) ? (tabParam as Tab) : "margin";

  const supabase = await createServerClient();

  // ============================================================
  // Fetch in parallelo i dati necessari ai 4 tab (mirror del
  // pattern Trading Desk). I tab non attivi pagano il fetch ma
  // l'UI carica gli altri istantaneamente al cambio tab.
  // ============================================================

  // 1. MARGIN — forecast PUN 180g + competitor benchmark variabile
  const marginForecastP = supabase.rpc("get_forecast_chart_data", {
    p_asset_id: 1,
    p_horizon_days: 180,
  });
  const marginCompetitorP = supabase.rpc("get_competitor_spread_stats", {
    p_commodity: "electricity",
    p_price_type: "variabile",
  });

  // 2. CUSTOMER — offerte mercato libero + forecast PUN/PSV 90g
  const customerOffersP = supabase.rpc("get_active_mercato_libero_offers", {
    p_customer_segment: "domestico",
  });
  const customerPunFcP = supabase.rpc("get_forecast_latest", {
    p_asset_slugs: ["pun"],
    p_horizon_days: 90,
  });
  const customerPsvFcP = supabase.rpc("get_forecast_latest", {
    p_asset_slugs: ["psv"],
    p_horizon_days: 90,
  });

  // 3. FORECAST SCENARI — stesso forecast PUN 180g del MARGIN (riusiamo!)
  // 4. REPORT — latest prices + forecast 30g + forecast 90g + metrics
  const reportLatestPricesP = supabase
    .from("mv_latest_price_per_asset")
    .select("asset_slug, display_name_it, unit, value, observed_at")
    .in("asset_slug", ["pun", "psv", "ttf", "brent", "co2"]);
  const reportFc30P = supabase.rpc("get_forecast_latest", {
    p_asset_slugs: ["pun", "psv", "ttf"],
    p_horizon_days: 30,
  });
  const reportFc90P = supabase.rpc("get_forecast_latest", {
    p_asset_slugs: ["pun", "psv", "ttf"],
    p_horizon_days: 90,
  });
  const reportMetricsP = supabase.rpc("get_forecast_metrics_latest");

  const [
    marginForecast,
    marginCompetitor,
    customerOffers,
    customerPunFc,
    customerPsvFc,
    reportLatestPrices,
    reportFc30,
    reportFc90,
    reportMetrics,
  ] = await Promise.all([
    marginForecastP,
    marginCompetitorP,
    customerOffersP,
    customerPunFcP,
    customerPsvFcP,
    reportLatestPricesP,
    reportFc30P,
    reportFc90P,
    reportMetricsP,
  ]);

  // ============================================================
  // SHAPE MARGIN
  // ============================================================
  const marginForecastPoints = ((marginForecast.data ?? []) as ForecastChartRow[]).map((r) => ({
    date: String(r.date),
    source: r.source as "history" | "forecast",
    value: Number(r.value),
    value_lower: r.value_lower === null ? null : Number(r.value_lower),
    value_upper: r.value_upper === null ? null : Number(r.value_upper),
  }));
  const compRow =
    Array.isArray(marginCompetitor.data) && marginCompetitor.data[0]
      ? (marginCompetitor.data[0] as CompetitorRow)
      : null;
  const competitor = compRow
    ? {
        medianEurPerMwh: Number(compRow.median_eur_mwh),
        p25EurPerMwh: Number(compRow.p25_eur_mwh),
        p75EurPerMwh: Number(compRow.p75_eur_mwh),
        nOfferte: compRow.n_offerte,
        source: String(compRow.source ?? "placet_arera"),
      }
    : {
        medianEurPerMwh: 60,
        p25EurPerMwh: 40,
        p75EurPerMwh: 100,
        nOfferte: 0,
        source: "placet_arera",
      };
  const fcRows = marginForecastPoints.filter((p) => p.source === "forecast");
  const marginForecastAvg =
    fcRows.length > 0 ? fcRows.reduce((s, p) => s + p.value, 0) / fcRows.length : 100;

  // PUN spot per Churn Predictor: ultimo punto storico disponibile
  const historyRows = marginForecastPoints.filter((p) => p.source === "history");
  const latestPunSpot =
    historyRows.length > 0 ? historyRows[historyRows.length - 1].value : marginForecastAvg;

  // ============================================================
  // SHAPE CUSTOMER
  // ============================================================
  const offers: OfferRecord[] = ((customerOffers.data ?? []) as OfferRow[]).map((r) => ({
    offer_code: r.offer_code,
    supplier: r.supplier,
    supplier_logo_url: r.supplier_logo_url,
    offer_name: r.offer_name,
    commodity: r.commodity as "electricity" | "gas",
    price_type: r.price_type as "fisso" | "variabile",
    price_value: Number(r.price_value),
    fixed_cost_monthly: r.fixed_cost_monthly === null ? null : Number(r.fixed_cost_monthly),
    customer_segment: r.customer_segment as "domestico" | "business",
    source_url: r.source_url,
    notes: r.notes,
  }));
  const punValue =
    Array.isArray(customerPunFc.data) && customerPunFc.data[0]
      ? Number((customerPunFc.data[0] as { value: number | string }).value)
      : 100;
  const psvValue =
    Array.isArray(customerPsvFc.data) && customerPsvFc.data[0]
      ? Number((customerPsvFc.data[0] as { value: number | string }).value)
      : 35;
  const customerForecast: ForecastAverages = {
    punAvgEurPerKwh: punValue / 1000,
    psvAvgEurPerSmc: (psvValue / 1000) * 10.5275,
  };

  // ============================================================
  // SHAPE FORECAST SCENARI (riusa marginForecastPoints)
  // ============================================================
  const forecastBaseline: ForecastPoint[] = marginForecastPoints;

  // ============================================================
  // SHAPE REPORT
  // ============================================================
  const snapshot: ReportSnapshot = {
    latestPrices: ((reportLatestPrices.data ?? []) as Array<{
      asset_slug: string;
      display_name_it: string;
      unit: string;
      value: number | string;
      observed_at: string;
    }>).map((r) => ({
      slug: r.asset_slug,
      name: r.display_name_it,
      unit: r.unit,
      value: Number(r.value),
      observedAt: r.observed_at,
    })),
    fc30: ((reportFc30.data ?? []) as ForecastLatestRow[]).map((r) => ({
      slug: r.asset_slug,
      name: r.display_name_it,
      unit: r.unit,
      value: Number(r.value),
    })),
    fc90: ((reportFc90.data ?? []) as ForecastLatestRow[]).map((r) => ({
      slug: r.asset_slug,
      name: r.display_name_it,
      unit: r.unit,
      value: Number(r.value),
    })),
    metrics: ((reportMetrics.data ?? []) as MetricsRow[]).map((r) => ({
      slug: r.asset_slug,
      horizon: r.horizon_days,
      mape: r.mape === null ? null : Number(r.mape),
      hitRatio: r.hit_ratio === null ? null : Number(r.hit_ratio),
    })),
    generatedAt: new Date().toISOString(),
  };

  return (
    <>
      <EidxProHeader section="Marketing Desk" />
      <MarketingDashboardView
        activeTab={tab}
        margin={{
          forecastPoints: marginForecastPoints,
          forecastAvgEurPerMwh: marginForecastAvg,
          competitor,
        }}
        customer={{
          offers,
          forecast: customerForecast,
        }}
        forecast={{
          baseline: forecastBaseline,
        }}
        report={{
          snapshot,
        }}
        churn={{
          marketPunEurPerMwh: latestPunSpot,
        }}
      />
    </>
  );
}
