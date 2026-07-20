import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { TrackRecordTable, type TrackRecordRow } from "@/components/forecast/TrackRecordTable";
import { ForecastChart, type ForecastChartPoint } from "@/components/forecast/ForecastChart";
import { breadcrumbList, jsonLdString } from "@/lib/seo/jsonld";

export const dynamic = "force-dynamic";

/**
 * generateMetadata dinamico: emette SEMPRE lo stesso canonical
 * (https://energyindex.it/it/forecast/track-record) indipendentemente
 * dai searchParams asset/fh. Cosi' Google capisce che tutte le varianti
 * ?asset=pun&fh=7, ?asset=psv&fh=180, ecc. sono la STESSA pagina e ne
 * indicizza solo una — no piu' "Pagina duplicata senza URL canonico".
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string; fh?: string }>;
}): Promise<Metadata> {
  const { asset, fh } = await searchParams;
  const activeLabel =
    asset && fh
      ? ` (${asset.toUpperCase()} · ${fh}gg)`
      : "";
  return {
    title: `Track record forecast${activeLabel} — Energy Index`,
    description:
      "Dashboard dei forecast emessi vs realta' negli ultimi 12 mesi. MAPE, RMSE, hit ratio e coverage per asset x orizzonte.",
    alternates: {
      // Canonical FISSO alla base URL — strippiamo asset/fh
      canonical: "https://energyindex.it/it/forecast/track-record",
    },
    openGraph: {
      title: "Track record forecast PUN/PSV/TTF — Energy Index",
      description: "Verifica empirica delle previsioni del modello Energy Index.",
      type: "website",
      locale: "it_IT",
      url: "/it/forecast/track-record",
    },
  };
}

const SLUGS = ["pun", "psv", "ttf"] as const;
const HORIZONS = [7, 30, 90, 180] as const;

export default async function TrackRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string; fh?: string }>;
}) {
  const { asset: assetParam, fh: fhParam } = await searchParams;
  const selectedAsset = (SLUGS as readonly string[]).includes(assetParam ?? "")
    ? (assetParam as (typeof SLUGS)[number])
    : "pun";
  const requestedH = Number(fhParam ?? 30);
  const selectedH = (HORIZONS as readonly number[]).includes(requestedH) ? requestedH : 30;

  const supabase = await createServerClient();

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

  const { data: assetRow } = await supabase
    .from("assets")
    .select("id, unit")
    .eq("slug", selectedAsset)
    .maybeSingle();

  let chartPoints: ForecastChartPoint[] = [];
  let unit = "€/MWh";
  if (assetRow) {
    unit = String(assetRow.unit ?? "€/MWh");
    const { data: chartData } = await supabase.rpc("get_forecast_chart_data", {
      p_asset_id: Number(assetRow.id),
      p_horizon_days: selectedH,
    });
    chartPoints = ((chartData ?? []) as { date: string; source: string; value: number | string; value_lower: number | string | null; value_upper: number | string | null }[]).map((r) => ({
      date: String(r.date),
      source: r.source as "history" | "forecast",
      value: Number(r.value),
      value_lower: r.value_lower === null ? null : Number(r.value_lower),
      value_upper: r.value_upper === null ? null : Number(r.value_upper),
    }));
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            breadcrumbList([
              { name: "Home", url: "https://energyindex.it/it" },
              { name: "Forecast", url: "https://energyindex.it/it/forecast" },
              { name: "Track record", url: "https://energyindex.it/it/forecast/track-record" },
            ]),
          ),
        }}
      />

      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold">Track record dei forecast</h1>
        <p className="text-muted-foreground">
          Confronto forecast emessi vs valori reali osservati. Aggiornamento giornaliero.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Asset:</span>
          {SLUGS.map((s) => (
            <a
              key={s}
              href={`/it/forecast/track-record?asset=${s}&fh=${selectedH}`}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                s === selectedAsset ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"
              }`}
            >
              {s.toUpperCase()}
            </a>
          ))}
          <span className="text-sm text-muted-foreground ml-4">Orizzonte:</span>
          {HORIZONS.map((h) => (
            <a
              key={h}
              href={`/it/forecast/track-record?asset=${selectedAsset}&fh=${h}`}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                h === selectedH ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"
              }`}
            >
              {h}g
            </a>
          ))}
        </div>

        {chartPoints.length > 0 ? (
          <ForecastChart points={chartPoints} unit={unit} />
        ) : (
          <p className="text-muted-foreground">Nessun dato chart per questa selezione.</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Metriche aggregate</h2>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">In raccolta.</p>
        ) : (
          <TrackRecordTable rows={rows} />
        )}
      </section>
    </div>
  );
}
