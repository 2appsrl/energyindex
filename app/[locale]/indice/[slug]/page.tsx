import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { LatestValueCard } from "@/components/LatestValueCard";
import { PriceChart } from "@/components/chart/PriceChart";
import { FaqSection } from "@/components/FaqSection";
import { CtaToEnergiapro } from "@/components/CtaToEnergiapro";

export const revalidate = 3600;
export const dynamicParams = true;

const SUPPORTED_SLUGS = ["pun"] as const; // PSV will be added in Slice 2

const SLUG_DESCRIPTIONS: Record<string, string> = {
  pun: "Prezzo Unico Nazionale del mercato elettrico italiano. Asta MGP del giorno prima, esiti pubblicati intorno alle 12:30.",
};

export default async function IndicePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  if (!SUPPORTED_SLUGS.includes(slug as (typeof SUPPORTED_SLUGS)[number])) {
    notFound();
  }

  const supabase = await createServerClient();

  // Asset metadata (display_name_it, unit, etc.) — read from MV (1 row, light query)
  const { data: assetMeta } = await supabase
    .from("mv_latest_price_per_asset")
    .select("asset_id, asset_slug, display_name_it, unit, commodity, pricing_kind")
    .eq("asset_slug", slug)
    .maybeSingle();

  if (!assetMeta) {
    return (
      <div className="container mx-auto py-16 px-4">
        <h1 className="text-3xl font-bold">Dati in arrivo</h1>
        <p className="mt-4 text-muted-foreground">
          La prima rilevazione dell&apos;indice {slug.toUpperCase()} arrivera al
          prossimo aggiornamento.
        </p>
      </div>
    );
  }

  // The MV exposes the LATEST observed_at, which on energy markets is the
  // last hour of TOMORROW's day-ahead (already published today at ~12:30 CEST).
  // For the "current price" big number we want the price valid right NOW —
  // i.e., the most recent observation whose observed_at <= now.
  // For the chart we show the past 168h up to now (no future hours).
  const nowIso = new Date().toISOString();
  const oneWeekAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: history } = await supabase
    .from("price_observations")
    .select("observed_at, value")
    .eq("asset_id", assetMeta.asset_id)
    .gte("observed_at", oneWeekAgo)
    .lte("observed_at", nowIso)
    .order("observed_at", { ascending: true });

  const points = (history ?? []).map((p) => ({
    observed_at: String(p.observed_at),
    value: Number(p.value),
  }));

  // "Latest" = most recent point in the past-168h window (i.e., the price
  // for the hour we are currently in, or the most recent past hour).
  const latestPoint = points.length > 0 ? points[points.length - 1] : null;

  if (!latestPoint) {
    return (
      <div className="container mx-auto py-16 px-4">
        <h1 className="text-3xl font-bold">Dati in arrivo</h1>
        <p className="mt-4 text-muted-foreground">
          Nessuna rilevazione recente per {slug.toUpperCase()}.
        </p>
      </div>
    );
  }

  const prevValue =
    points.length >= 2 ? points[points.length - 2].value : undefined;

  const description = SLUG_DESCRIPTIONS[slug] ?? "";

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tabular-nums">
          {assetMeta.display_name_it}
        </h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </header>

      <LatestValueCard
        display_name={assetMeta.display_name_it}
        value={latestPoint.value}
        prev_value={prevValue}
        unit={assetMeta.unit}
        observed_at={latestPoint.observed_at}
      />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Andamento ultime 168 ore</h2>
        <PriceChart points={points} unit={assetMeta.unit} />
      </section>

      <FaqSection slug={slug} />

      <CtaToEnergiapro campaign={`indice-${slug}`} />
    </div>
  );
}
