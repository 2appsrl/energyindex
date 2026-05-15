import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { ForecastChart } from "./ForecastChart";
import { DriverAttribution } from "./DriverAttribution";

interface DriverDB {
  name: string;
  label: string;
  contribution: number;
  direction: "up" | "down";
}

interface ChartRow {
  date: string;
  source: "history" | "forecast";
  value: number | string;
  value_lower: number | string | null;
  value_upper: number | string | null;
}

const HORIZON_LABELS: Record<number, string> = {
  7: "7 giorni",
  30: "30 giorni",
  90: "90 giorni",
  180: "180 giorni",
};

/**
 * Server component: sezione forecast inline dentro /it/indice/[slug].
 * Carica dati via RPC e renderizza chart + drivers + horizon selector.
 */
export async function ForecastSection({
  assetSlug,
  assetId,
  unit,
  horizonDays = 30,
}: {
  assetSlug: string;
  assetId: number;
  unit: string;
  horizonDays?: number;
}) {
  const supabase = await createServerClient();

  const { data: chartData } = await supabase.rpc("get_forecast_chart_data", {
    p_asset_id: assetId,
    p_horizon_days: horizonDays,
  });

  const points = ((chartData ?? []) as ChartRow[]).map((r) => ({
    date: String(r.date),
    source: r.source,
    value: Number(r.value),
    value_lower: r.value_lower === null ? null : Number(r.value_lower),
    value_upper: r.value_upper === null ? null : Number(r.value_upper),
  }));

  const { data: latest } = await supabase.rpc("get_forecast_latest", {
    p_asset_slugs: [assetSlug],
    p_horizon_days: horizonDays,
  });
  const latestRow = Array.isArray(latest) ? latest[0] : null;
  const drivers: DriverDB[] = (latestRow?.drivers as DriverDB[] | null) ?? [];

  const hasForecast = points.some((p) => p.source === "forecast");

  return (
    <section id="forecast" className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">
          Previsione a {HORIZON_LABELS[horizonDays] ?? `${horizonDays}g`}
        </h2>
        <p className="text-sm text-muted-foreground">
          Forecast giornaliero generato con modello Ridge regression. La banda 5–95% è calibrata via conformal prediction sugli ultimi 90 giorni.
          {" "}
          <Link href="/it/forecast/metodologia" className="underline">Metodologia</Link>
          {" · "}
          <Link href="/it/forecast/track-record" className="underline">Track record</Link>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[7, 30, 90, 180].map((h) => (
          <a
            key={h}
            href={`/it/indice/${assetSlug}?fh=${h}#forecast`}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              h === horizonDays
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-accent border-border"
            }`}
          >
            {h}g
          </a>
        ))}
      </div>

      {!hasForecast ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Forecast in elaborazione. La prima emissione sarà disponibile al prossimo ciclo daily.
        </div>
      ) : (
        <>
          <ForecastChart points={points} unit={unit} />
          <DriverAttribution drivers={drivers} unit={unit} />
        </>
      )}
    </section>
  );
}
