import type { Metadata } from "next";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { EidxProHeader } from "@/components/pro/EidxProHeader";
import { MarginSimulator } from "@/components/pro/MarginSimulator";
import { lockProChannels, parseChannelRows } from "@/lib/pro/channel-benchmark";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Margin Simulator — EIDX Pro",
  alternates: { canonical: "https://energyindex.it/it/pro/simulator" },
  description:
    "Simulatore di margine per fornitori energy: spread vendita, scenari stress, posizionamento competitor. Demo gratuita.",
  robots: { index: false, follow: true },
};

interface ForecastRow {
  date: string;
  source: string;
  value: number | string;
  value_lower: number | string | null;
  value_upper: number | string | null;
}

export default async function SimulatorPage() {
  const supabase = await createServerClient();

  // Forecast PUN (asset_id=1) a 180g — copre la massima durata contratto
  // selezionabile (24m) almeno parzialmente; il modello viene cmq usato
  // come media per fase 1.
  const { data: chartRaw } = await supabase.rpc("get_forecast_chart_data", {
    p_asset_id: 1,
    p_horizon_days: 180,
  });

  // Competitor benchmark a 3 canali: electricity variabile (PMI tipica).
  const { data: compRaw } = await supabase.rpc("get_competitor_spread_stats_channels", {
    p_commodity: "electricity",
    p_price_type: "variabile",
  });

  const forecastPoints = ((chartRaw ?? []) as ForecastRow[]).map((r) => ({
    date: String(r.date),
    source: r.source as "history" | "forecast",
    value: Number(r.value),
    value_lower: r.value_lower === null ? null : Number(r.value_lower),
    value_upper: r.value_upper === null ? null : Number(r.value_upper),
  }));

  // Demo pubblica: il canale online_brand (scraping) e' riservato al tier
  // Pro — i percentili non lasciano il server, resta il conteggio teaser.
  const channels = lockProChannels(parseChannelRows(compRaw));

  const forecastRows = forecastPoints.filter((p) => p.source === "forecast");
  const forecastAvg =
    forecastRows.length > 0
      ? forecastRows.reduce((s, p) => s + p.value, 0) / forecastRows.length
      : 100;

  return (
    <>
      <EidxProHeader section="Margin Simulator" />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-stone-900">
            Simulazione margine retail
          </h1>
          <p className="text-sm text-stone-600">
            Forecast PUN base &middot; scenari stress + benchmark mercato
            &middot; banda 5–95%
          </p>
        </header>

        <MarginSimulator
          forecastPoints={forecastPoints}
          forecastAvgEurPerMwh={forecastAvg}
          channels={channels}
        />

        <footer className="pt-6 border-t border-stone-200 text-xs text-stone-500 flex justify-between flex-wrap gap-2">
          <span>
            Fonti: GME (PUN), Terna, EEX, EIA &middot; Modello{" "}
            <Link
              href="/it/forecast/metodologia"
              className="underline hover:text-stone-700"
            >
              Ridge v1.0
            </Link>{" "}
            &middot; MAPE 30g (PUN): consulta{" "}
            <Link
              href="/it/forecast/track-record"
              className="underline hover:text-stone-700"
            >
              track record live
            </Link>
          </span>
          <span className="text-stone-400">
            EIDX demo pubblica &middot; funzioni Pro a pagamento
          </span>
        </footer>
      </div>
    </>
  );
}
