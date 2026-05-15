import type { Metadata } from "next";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { ForecastCard } from "@/components/forecast/ForecastCard";
import { TrackRecordTable, type TrackRecordRow } from "@/components/forecast/TrackRecordTable";
import { CtaToEnergiapro } from "@/components/CtaToEnergiapro";
import {
  breadcrumbList,
  forecastDataset,
  jsonLdString,
} from "@/lib/seo/jsonld";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Previsioni PUN, PSV, TTF — Energy Index",
  description:
    "Forecast giornalieri di PUN, PSV e TTF a 7/30/90/180 giorni, con banda di confidenza calibrata e track record verificabile. Metodologia trasparente, dataset gratuito.",
  openGraph: {
    title: "Previsioni PUN, PSV, TTF — Energy Index",
    description:
      "Forecast gratuiti di prezzi energetici italiani con track record live e metodologia pubblica.",
    type: "website",
    locale: "it_IT",
    url: "/it/forecast",
  },
  twitter: { card: "summary_large_image" },
};

interface LatestForecastRow {
  asset_slug: string;
  display_name_it: string;
  unit: string;
  forecast_date: string;
  generated_at: string;
  value: number | string;
  value_lower: number | string;
  value_upper: number | string;
  drivers: unknown;
  spot_value: number | string | null;
}

export default async function ForecastIndexPage() {
  const supabase = await createServerClient();

  const { data: latest } = await supabase.rpc("get_forecast_latest", {
    p_asset_slugs: ["pun", "psv", "ttf"],
    p_horizon_days: 30,
  });
  const cards = ((latest ?? []) as LatestForecastRow[]).map((r) => ({
    assetSlug: r.asset_slug,
    assetName: r.display_name_it,
    unit: r.unit,
    forecastDate: r.forecast_date,
    spotValue: r.spot_value === null ? null : Number(r.spot_value),
    value: Number(r.value),
    valueLower: Number(r.value_lower),
    valueUpper: Number(r.value_upper),
    horizonDays: 30,
    drivers: Array.isArray(r.drivers) ? r.drivers as { name: string; label: string; contribution: number; direction: "up"|"down" }[] : [],
  }));

  const { data: metricsRows } = await supabase.rpc("get_forecast_metrics_latest");
  const rows: TrackRecordRow[] = ((metricsRows ?? []) as unknown[]).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      asset_slug: String(r.asset_slug),
      display_name_it: String(r.display_name_it),
      horizon_days: Number(r.horizon_days),
      period_start: String(r.period_start),
      period_end: String(r.period_end),
      mape: r.mape === null ? null : Number(r.mape),
      rmse: r.rmse === null ? null : Number(r.rmse),
      hit_ratio: r.hit_ratio === null ? null : Number(r.hit_ratio),
      coverage: r.coverage === null ? null : Number(r.coverage),
      n_observations: Number(r.n_observations),
    };
  });

  return (
    <div className="container mx-auto px-4 py-10 space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            forecastDataset({
              name: "Forecast PUN/PSV/TTF — Energy Index",
              description:
                "Previsioni giornaliere a 7/30/90/180 giorni con banda di confidenza 5-95%, generate con modello Ridge regression e conformal prediction. Aggiornamento daily.",
              url: "https://energyindex.it/it/forecast",
              keywords: ["forecast", "previsioni", "PUN", "PSV", "TTF", "energia", "Italia"],
              temporalCoverage: "2025-05-15/..",
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            breadcrumbList([
              { name: "Home", url: "https://energyindex.it/it" },
              { name: "Forecast", url: "https://energyindex.it/it/forecast" },
            ]),
          ),
        }}
      />

      <header className="space-y-4 max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Previsioni PUN, PSV, TTF — trasparenza radicale
        </h1>
        <p className="text-lg text-muted-foreground">
          Forecast giornalieri a 7, 30, 90 e 180 giorni con banda di confidenza calibrata. Modello statistico pubblico, track record live, metodologia consultabile.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <a href="#track-record" className="underline">Vedi track record</a>
          <Link href="/it/forecast/metodologia" className="underline">Metodologia</Link>
          <Link href="/it/forecast/track-record" className="underline">Dashboard completa</Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.length === 0 ? (
          <p className="text-muted-foreground col-span-full">
            Forecast in arrivo: prima emissione al prossimo ciclo daily.
          </p>
        ) : (
          cards.map((c) => <ForecastCard key={c.assetSlug} {...c} />)
        )}
      </section>

      <section id="track-record" className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Track record verificabile</h2>
          <p className="text-sm text-muted-foreground">
            Metriche aggregate sugli ultimi 90 giorni e ultimi 12 mesi. Aggiornate giornalmente.
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">In raccolta: la prima finestra metrica sarà disponibile dopo il bootstrap walk-forward.</p>
        ) : (
          <TrackRecordTable rows={rows} />
        )}
      </section>

      <CtaToEnergiapro campaign="forecast-index" />
    </div>
  );
}
