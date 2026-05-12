import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { PriceShowcaseCard } from "@/components/home/PriceShowcaseCard";
import { MarketBanner } from "@/components/home/MarketBanner";

export const metadata: Metadata = {
  title: "Energy Index — Prezzi luce e gas in tempo reale",
  description:
    "Osservatorio gratuito su PUN (luce), PSV (gas) e offerte ARERA mercato libero. Confronta tariffe luce e gas in pochi click.",
  openGraph: {
    title: "Energy Index — Prezzi luce e gas in tempo reale",
    description:
      "Osservatorio gratuito su PUN, PSV e offerte ARERA mercato libero.",
    type: "website",
    locale: "it_IT",
    url: "/it",
  },
  twitter: {
    card: "summary_large_image",
    title: "Energy Index — Prezzi luce e gas in tempo reale",
    description: "Osservatorio gratuito su PUN, PSV e offerte ARERA mercato libero.",
  },
};

async function getLatestPair(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  slug: string,
): Promise<{ value: number | null; prevValue: number | null; unit: string }> {
  const { data: meta } = await supabase
    .from("mv_latest_price_per_asset")
    .select("asset_id, unit")
    .eq("asset_slug", slug)
    .maybeSingle();
  if (!meta) return { value: null, prevValue: null, unit: "€/MWh" };

  const nowIso = new Date().toISOString();
  const { data: rows } = await supabase
    .from("price_observations")
    .select("value")
    .eq("asset_id", meta.asset_id)
    .lte("observed_at", nowIso)
    .order("observed_at", { ascending: false })
    .limit(2);

  return {
    value: rows?.[0] ? Number(rows[0].value) : null,
    prevValue: rows?.[1] ? Number(rows[1].value) : null,
    unit: (meta.unit as string) ?? "€/MWh",
  };
}

async function getMarketBannerData(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<{ luceVariabileMedian: number | null; totalOffers: number }> {
  // Latest luce-variabile aggregate
  const { data: latest } = await supabase
    .from("energy_index_aggregates")
    .select("median, sample_size, computed_at")
    .eq("aggregate_slug", "mercato-libero-luce-variabile")
    .order("computed_at", { ascending: false })
    .limit(1);

  if (!latest || latest.length === 0) {
    return { luceVariabileMedian: null, totalOffers: 0 };
  }

  // Total offers ON THAT same computed_at across all 4 slugs
  const latestDate = latest[0].computed_at;
  const { data: totals } = await supabase
    .from("energy_index_aggregates")
    .select("sample_size")
    .eq("computed_at", latestDate);

  const total = (totals ?? []).reduce(
    (s, r) => s + Number(r.sample_size ?? 0),
    0,
  );
  return {
    luceVariabileMedian: Number(latest[0].median),
    totalOffers: total,
  };
}

export default async function HomeIt() {
  const supabase = await createServerClient();
  const [pun, psv, market] = await Promise.all([
    getLatestPair(supabase, "pun"),
    getLatestPair(supabase, "psv"),
    getMarketBannerData(supabase),
  ]);

  return (
    <div className="container mx-auto py-12 sm:py-16 px-4 space-y-8 sm:space-y-10">
      <header className="space-y-3">
        <h1 className="text-4xl sm:text-5xl font-bold">Energy Index</h1>
        <p className="text-muted-foreground text-base sm:text-lg">
          Osservatorio prezzi luce e gas in tempo reale.
        </p>
      </header>

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
        <PriceShowcaseCard
          href="/it/indice/pun"
          icon="zap"
          title="Energia Elettrica"
          value={pun.value}
          prevValue={pun.prevValue}
          unit={pun.unit}
          ariaLabel="Apri analisi prezzi energia elettrica"
        />
        <PriceShowcaseCard
          href="/it/indice/psv"
          icon="flame"
          title="Gas"
          value={psv.value}
          prevValue={psv.prevValue}
          unit={psv.unit}
          ariaLabel="Apri analisi prezzi gas"
        />
      </div>

      <MarketBanner
        luceVariabileMedian={market.luceVariabileMedian}
        totalOffers={market.totalOffers}
      />
    </div>
  );
}
