import { createServerClient } from "@/lib/supabase/server";
import { PriceShowcaseCard } from "@/components/home/PriceShowcaseCard";

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

export default async function HomeIt() {
  const supabase = await createServerClient();
  const [pun, psv] = await Promise.all([
    getLatestPair(supabase, "pun"),
    getLatestPair(supabase, "psv"),
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
    </div>
  );
}
