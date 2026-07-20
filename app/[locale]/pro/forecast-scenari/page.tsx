import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { EidxProHeader } from "@/components/pro/EidxProHeader";
import { ForecastScenariView } from "@/components/pro/ForecastScenariView";
import type { ForecastPoint } from "@/lib/pro/forecast-scenari-math";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Forecast & Scenari — EIDX Pro",
  description: "Modifica gli input (TTF, Brent, CO2, temperatura) e vedi come cambia il forecast PUN in tempo reale.",
  robots: { index: false },
};

interface ChartRow {
  date: string;
  source: string;
  value: number | string;
  value_lower: number | string | null;
  value_upper: number | string | null;
}

export default async function ForecastScenariPage() {
  const supabase = await createServerClient();

  // Carica forecast PUN 180g (baseline) — asset_id=1, horizon=180
  const { data: chartRaw } = await supabase.rpc("get_forecast_chart_data", {
    p_asset_id: 1,
    p_horizon_days: 180,
  });

  const baseline: ForecastPoint[] = ((chartRaw ?? []) as ChartRow[]).map((r) => ({
    date: String(r.date),
    source: r.source as "history" | "forecast",
    value: Number(r.value),
    value_lower: r.value_lower === null ? null : Number(r.value_lower),
    value_upper: r.value_upper === null ? null : Number(r.value_upper),
  }));

  return (
    <>
      <EidxProHeader section="Forecast & Scenari" />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1 max-w-2xl">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Forecast & Scenari what-if</h1>
          <p className="text-sm text-stone-600">
            Modifica i driver del PUN e vedi come si deforma il forecast in tempo reale. Sensitivity basate sui pesi del modello Ridge.
          </p>
        </header>

        <ForecastScenariView baseline={baseline} />

        <footer className="pt-6 border-t border-stone-200 text-xs text-stone-500 flex justify-between flex-wrap gap-2">
          <span>
            Forecast PUN 180g baseline · modello Ridge v1.0 · sensitivity lineare di prima approssimazione
          </span>
          <span className="text-stone-400">
            Tier Pro: orizzonti 24 mesi + scenari multipli salvati (in arrivo)
          </span>
        </footer>
      </div>
    </>
  );
}
