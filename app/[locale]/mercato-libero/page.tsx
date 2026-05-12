import { createServerClient } from "@/lib/supabase/server";
import { AGGREGATE_SLUGS, type AggregateSlug } from "@/lib/arera-aggregates";
import { AggregateCard } from "@/components/mercato-libero/AggregateCard";
import {
  AggregateTrendChart,
  type TrendSeries,
} from "@/components/mercato-libero/AggregateTrendChart";
import { CtaToEnergiapro } from "@/components/CtaToEnergiapro";
import { FaqSection } from "@/components/FaqSection";

const COLORS: Record<AggregateSlug, string> = {
  "mercato-libero-luce-fissa": "#14d97a",
  "mercato-libero-luce-variabile": "#10b981",
  "mercato-libero-gas-fissa": "#f59e0b",
  "mercato-libero-gas-variabile": "#fb923c",
};

// Conversione wholesale -> retail unit.
// PUN e' pubblicato in €/MWh; il retail luce e' in €/kWh.
const PUN_MWH_TO_KWH = 1 / 1000;
// PSV e' pubblicato in €/MWh; il retail gas e' in €/Smc.
// Standard ARERA: 1 Smc gas naturale = 10,5275 kWh (PCS).
const PSV_MWH_TO_SMC = 10.5275 / 1000;

interface AggregateRow {
  aggregate_slug: string;
  computed_at: string;
  median: number;
  p25: number | null;
  p75: number | null;
  min: number | null;
  sample_size: number;
  unit: string;
}

export default async function MercatoLiberoPage() {
  const supabase = await createServerClient();

  // 1. Latest per ognuno dei 4 slug
  const slugs = AGGREGATE_SLUGS.map((a) => a.slug);
  const { data: latest } = await supabase
    .from("energy_index_aggregates")
    .select("aggregate_slug, computed_at, median, p25, p75, min, sample_size, unit")
    .in("aggregate_slug", slugs)
    .order("computed_at", { ascending: false });

  const latestBySlug = new Map<string, AggregateRow>();
  for (const r of (latest ?? []) as AggregateRow[]) {
    if (!latestBySlug.has(r.aggregate_slug))
      latestBySlug.set(r.aggregate_slug, r);
  }

  // 2. Trend ultimi 365 giorni — aggregati ARERA
  const oneYearAgo = new Date();
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  const { data: trend } = await supabase
    .from("energy_index_aggregates")
    .select("aggregate_slug, computed_at, median")
    .in("aggregate_slug", slugs)
    .gte("computed_at", oneYearAgo.toISOString().slice(0, 10))
    .order("computed_at", { ascending: true });

  const trendBySlug = new Map<string, Array<{ date: string; value: number }>>();
  for (const r of (trend ?? []) as Array<{
    aggregate_slug: string;
    computed_at: string;
    median: number;
  }>) {
    const arr = trendBySlug.get(r.aggregate_slug) ?? [];
    arr.push({ date: String(r.computed_at), value: Number(r.median) });
    trendBySlug.set(r.aggregate_slug, arr);
  }

  // 3. Wholesale daily series (PUN + PSV) per calcolare "variabile effettivo".
  //    Bucket = 'day': aggrega media giornaliera dal data orario PUN; PSV e'
  //    gia' daily.
  const [punSeries, psvSeries] = await Promise.all([
    supabase.rpc("get_price_series", {
      p_asset_id: 1, // pun
      p_interval: "1 year",
      p_bucket: "day",
    }),
    supabase.rpc("get_price_series", {
      p_asset_id: 8, // psv
      p_interval: "1 year",
      p_bucket: "day",
    }),
  ]);
  const punByDate = new Map<string, number>();
  for (const r of (punSeries.data ?? []) as Array<{
    observed_at: string;
    value: number | string;
  }>) {
    // observed_at e' un timestamp (es. '2026-04-15T00:00:00+00:00'); chiave = YYYY-MM-DD
    punByDate.set(String(r.observed_at).slice(0, 10), Number(r.value));
  }
  const psvByDate = new Map<string, number>();
  for (const r of (psvSeries.data ?? []) as Array<{
    observed_at: string;
    value: number | string;
  }>) {
    psvByDate.set(String(r.observed_at).slice(0, 10), Number(r.value));
  }

  // 4. Compose chart series: per ogni commodity 2 linee (Fissa, Variabile effettivo).
  //    Variabile effettivo = wholesale(d) + alpha(d), nelle stesse unita' del retail.
  function buildEffectiveVariable(
    aggregateSlug: string,
    wholesaleByDate: Map<string, number>,
    conversionFactor: number,
  ): Array<{ date: string; value: number }> {
    const alphaPoints = trendBySlug.get(aggregateSlug) ?? [];
    const out: Array<{ date: string; value: number }> = [];
    for (const p of alphaPoints) {
      const w = wholesaleByDate.get(p.date);
      if (w === undefined) continue; // skip giorno senza wholesale
      out.push({ date: p.date, value: w * conversionFactor + p.value });
    }
    return out;
  }

  const electricSeries: TrendSeries[] = [
    {
      slug: "mercato-libero-luce-fissa",
      label: "Fissa (mediana)",
      color: COLORS["mercato-libero-luce-fissa"],
      points: trendBySlug.get("mercato-libero-luce-fissa") ?? [],
    },
    {
      slug: "mercato-libero-luce-variabile-effettivo",
      label: "Variabile effettivo (PUN + spread)",
      color: COLORS["mercato-libero-luce-variabile"],
      points: buildEffectiveVariable(
        "mercato-libero-luce-variabile",
        punByDate,
        PUN_MWH_TO_KWH,
      ),
    },
  ];
  const gasSeries: TrendSeries[] = [
    {
      slug: "mercato-libero-gas-fissa",
      label: "Fissa (mediana)",
      color: COLORS["mercato-libero-gas-fissa"],
      points: trendBySlug.get("mercato-libero-gas-fissa") ?? [],
    },
    {
      slug: "mercato-libero-gas-variabile-effettivo",
      label: "Variabile effettivo (PSV + spread)",
      color: COLORS["mercato-libero-gas-variabile"],
      points: buildEffectiveVariable(
        "mercato-libero-gas-variabile",
        psvByDate,
        PSV_MWH_TO_SMC,
      ),
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-10">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold">Mercato Libero</h1>
        <p className="text-muted-foreground">
          Osservatorio statistico delle offerte PLACET pubblicate dal Portale
          Offerte ARERA. I prezzi mostrati sono la mediana delle offerte attive
          con quartili p25 e p75.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {AGGREGATE_SLUGS.map((a) => {
          const row = latestBySlug.get(a.slug);
          const isSpread = a.priceType === "variabile";
          const referenceLabel = a.referenceAssetSlug.toUpperCase();
          return (
            <AggregateCard
              key={a.slug}
              title={a.displayName}
              median={row?.median ?? null}
              p25={row?.p25 ?? null}
              p75={row?.p75 ?? null}
              min={row?.min ?? null}
              sampleSize={row?.sample_size ?? 0}
              unit={a.unit}
              isSpread={isSpread}
              referenceLabel={referenceLabel}
            />
          );
        })}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">
          Luce — Fissa vs Variabile effettivo (PUN + spread)
        </h2>
        <p className="text-sm text-muted-foreground">
          Confronto giornaliero tra la mediana delle offerte fisse e il costo
          effettivo delle variabili (PUN nazionale del giorno + spread mediano
          ARERA). Per il consumatore: la linea più bassa = scelta più
          conveniente in quel giorno.
        </p>
        <AggregateTrendChart series={electricSeries} unit="€/kWh" />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">
          Gas — Fissa vs Variabile effettivo (PSV + spread)
        </h2>
        <p className="text-sm text-muted-foreground">
          Confronto giornaliero tra la mediana delle offerte fisse e il costo
          effettivo delle variabili (PSV daily-ahead convertito a €/Smc +
          spread mediano ARERA).
        </p>
        <AggregateTrendChart series={gasSeries} unit="€/Smc" />
      </section>

      <FaqSection slug="mercato-libero" />

      <CtaToEnergiapro campaign="mercato-libero" />
    </div>
  );
}
