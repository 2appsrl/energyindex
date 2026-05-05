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

  // Latest value from MV
  const { data: latest } = await supabase
    .from("mv_latest_price_per_asset")
    .select("*")
    .eq("asset_slug", slug)
    .maybeSingle();

  if (!latest) {
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

  // Storico ultime 168 ore
  const oneWeekAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: history } = await supabase
    .from("price_observations")
    .select("observed_at, value")
    .eq("asset_id", latest.asset_id)
    .gte("observed_at", oneWeekAgo)
    .order("observed_at", { ascending: true });

  const points = (history ?? []).map((p) => ({
    observed_at: String(p.observed_at),
    value: Number(p.value),
  }));

  const prevValue =
    points.length >= 2 ? points[points.length - 2].value : undefined;

  const description = SLUG_DESCRIPTIONS[slug] ?? "";

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tabular-nums">
          {latest.display_name_it}
        </h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </header>

      <LatestValueCard
        display_name={latest.display_name_it}
        value={Number(latest.value)}
        prev_value={prevValue}
        unit={latest.unit}
        observed_at={String(latest.observed_at)}
      />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Andamento ultime 168 ore</h2>
        <PriceChart points={points} unit={latest.unit} />
      </section>

      <FaqSection slug={slug} />

      <CtaToEnergiapro campaign={`indice-${slug}`} />
    </div>
  );
}
