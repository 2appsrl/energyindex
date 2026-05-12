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

interface AggregateRow {
  aggregate_slug: string;
  computed_at: string;
  median: number;
  p25: number | null;
  p75: number | null;
  sample_size: number;
  unit: string;
}

export default async function MercatoLiberoPage() {
  const supabase = await createServerClient();

  // 1. Latest per ognuno dei 4 slug
  const slugs = AGGREGATE_SLUGS.map((a) => a.slug);
  const { data: latest } = await supabase
    .from("energy_index_aggregates")
    .select("aggregate_slug, computed_at, median, p25, p75, sample_size, unit")
    .in("aggregate_slug", slugs)
    .order("computed_at", { ascending: false });

  const latestBySlug = new Map<string, AggregateRow>();
  for (const r of (latest ?? []) as AggregateRow[]) {
    if (!latestBySlug.has(r.aggregate_slug))
      latestBySlug.set(r.aggregate_slug, r);
  }

  // 2. Trend ultimi 365 giorni
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

  const electricSeries: TrendSeries[] = AGGREGATE_SLUGS.filter(
    (a) => a.commodity === "electricity",
  ).map((a) => ({
    slug: a.slug,
    label: a.displayShort,
    color: COLORS[a.slug],
    points: trendBySlug.get(a.slug) ?? [],
  }));
  const gasSeries: TrendSeries[] = AGGREGATE_SLUGS.filter(
    (a) => a.commodity === "gas",
  ).map((a) => ({
    slug: a.slug,
    label: a.displayShort,
    color: COLORS[a.slug],
    points: trendBySlug.get(a.slug) ?? [],
  }));

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
          Trend mediana ultimi 12 mesi — Luce
        </h2>
        <AggregateTrendChart series={electricSeries} unit="€/kWh" />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">
          Trend mediana ultimi 12 mesi — Gas
        </h2>
        <AggregateTrendChart series={gasSeries} unit="€/Smc" />
      </section>

      <FaqSection slug="mercato-libero" />

      <CtaToEnergiapro campaign="mercato-libero" />
    </div>
  );
}
