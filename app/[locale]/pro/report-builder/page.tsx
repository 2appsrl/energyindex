import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { EidxProHeader } from "@/components/pro/EidxProHeader";
import { ReportBuilderView, type ReportSnapshot } from "@/components/pro/ReportBuilderView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Report Builder — EIDX Pro",
  description: "Genera report PDF brandizzati con logo cliente, colore palette, snapshot mercato + forecast.",
  robots: { index: false },
};

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

export default async function ReportBuilderPage() {
  const supabase = await createServerClient();

  // Snapshot mercato corrente: ultimo PUN, PSV, TTF
  const { data: latestPrices } = await supabase
    .from("mv_latest_price_per_asset")
    .select("asset_slug, display_name_it, unit, value, observed_at")
    .in("asset_slug", ["pun", "psv", "ttf", "brent", "co2"]);

  // Forecast 30g + 90g per i 3 main
  const { data: fcRaw } = await supabase.rpc("get_forecast_latest", {
    p_asset_slugs: ["pun", "psv", "ttf"],
    p_horizon_days: 30,
  });
  const fc30 = ((fcRaw ?? []) as ForecastLatestRow[]).map((r) => ({
    slug: r.asset_slug,
    name: r.display_name_it,
    unit: r.unit,
    value: Number(r.value),
  }));

  const { data: fc90Raw } = await supabase.rpc("get_forecast_latest", {
    p_asset_slugs: ["pun", "psv", "ttf"],
    p_horizon_days: 90,
  });
  const fc90 = ((fc90Raw ?? []) as ForecastLatestRow[]).map((r) => ({
    slug: r.asset_slug,
    name: r.display_name_it,
    unit: r.unit,
    value: Number(r.value),
  }));

  // Metriche track record
  const { data: metricsRaw } = await supabase.rpc("get_forecast_metrics_latest");
  const metrics = ((metricsRaw ?? []) as MetricsRow[]).map((r) => ({
    slug: r.asset_slug,
    horizon: r.horizon_days,
    mape: r.mape === null ? null : Number(r.mape),
    hitRatio: r.hit_ratio === null ? null : Number(r.hit_ratio),
  }));

  const snapshot: ReportSnapshot = {
    latestPrices: ((latestPrices ?? []) as Array<{ asset_slug: string; display_name_it: string; unit: string; value: number | string; observed_at: string }>).map((r) => ({
      slug: r.asset_slug,
      name: r.display_name_it,
      unit: r.unit,
      value: Number(r.value),
      observedAt: r.observed_at,
    })),
    fc30,
    fc90,
    metrics,
    generatedAt: new Date().toISOString(),
  };

  return (
    <>
      <EidxProHeader section="Report Builder" />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1 max-w-2xl print:hidden">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Report Builder</h1>
          <p className="text-sm text-stone-600">
            Genera un report brandizzato con i dati del momento. Personalizza logo, colore e cliente. Stampa o salva in PDF.
          </p>
        </header>

        <ReportBuilderView snapshot={snapshot} />

        <footer className="pt-6 border-t border-stone-200 text-xs text-stone-500 print:hidden">
          <span>
            Demo: 1 template &quot;Monthly outlook&quot;. Tier Pro: schedulazione automatica, distribuzione mailing list, white-label completo, custom research (Modulo 03).
          </span>
        </footer>
      </div>
    </>
  );
}
