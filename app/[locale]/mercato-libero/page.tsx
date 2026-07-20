import { createServerClient } from "@/lib/supabase/server";
import { AGGREGATE_SLUGS, type AggregateSlug } from "@/lib/arera-aggregates";
import { AggregateCard } from "@/components/mercato-libero/AggregateCard";
import {
  AggregateTrendChart,
  type TrendSeries,
} from "@/components/mercato-libero/AggregateTrendChart";
import { SourceToggle } from "@/components/mercato-libero/SourceToggle";
import { CtaToEnergiapro } from "@/components/CtaToEnergiapro";
import { FaqSection } from "@/components/FaqSection";
import type { Metadata } from "next";
import { breadcrumbList, jsonLdString } from "@/lib/seo/jsonld";

// Mapping aggregate_slug -> (commodity, price_type) per la modalita' "libero".
// Stesso slug nella card UI, ma la sorgente dati cambia.
const PRICE_MAP: Record<
  AggregateSlug,
  { commodity: "electricity" | "gas"; price_type: "fisso" | "variabile" }
> = {
  "mercato-libero-luce-fissa": {
    commodity: "electricity",
    price_type: "fisso",
  },
  "mercato-libero-luce-variabile": {
    commodity: "electricity",
    price_type: "variabile",
  },
  "mercato-libero-gas-fissa": { commodity: "gas", price_type: "fisso" },
  "mercato-libero-gas-variabile": {
    commodity: "gas",
    price_type: "variabile",
  },
};

interface MercatoLiberoStatsRow {
  n_total: number;
  n_energiapro: number;
  n_scraping: number;
  p25: number | string | null;
  median: number | string | null;
  p75: number | string | null;
  best: number | string | null;
  fixed_cost_p25: number | string | null;
  fixed_cost_median: number | string | null;
  fixed_cost_p75: number | string | null;
  unit: string;
  last_updated: string | null;
}

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
  /** Mediana costo commercializzazione mensile (EUR/mese). Solo per
   *  source='libero', null per PLACET. */
  fixed_cost_median?: number | null;
  fixed_cost_p25?: number | null;
  fixed_cost_p75?: number | null;
}

export async function generateMetadata(): Promise<Metadata> {
  // Quante offerte totali sull'ultimo snapshot (4 slug × 1 row each via latest).
  let total = 0;
  try {
    const supabase = await createServerClient();
    const { data: totals } = await supabase
      .from("energy_index_aggregates")
      .select("aggregate_slug, sample_size, computed_at")
      .order("computed_at", { ascending: false });
    const seen = new Set<string>();
    for (const r of (totals ?? []) as Array<{ aggregate_slug: string; sample_size: number }>) {
      if (seen.has(r.aggregate_slug)) continue;
      seen.add(r.aggregate_slug);
      total += Number(r.sample_size ?? 0);
      if (seen.size >= 4) break;
    }
  } catch {
    total = 0;
  }

  const title = total > 0
    ? `Mercato libero luce e gas: ${total} offerte PLACET ARERA`
    : "Mercato libero luce e gas — Osservatorio offerte ARERA";
  const description =
    "Osservatorio statistico delle offerte PLACET mercato libero. Confronto mediana fissa vs variabile per luce e gas, storico 12 mesi, dati ARERA aggiornati ogni giorno.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "it_IT",
      url: "/it/mercato-libero",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function MercatoLiberoPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  const { src } = await searchParams;
  const source: "placet" | "libero" = src === "libero" ? "libero" : "placet";
  const tickerHref =
    source === "libero"
      ? "/it/mercato-libero/ticker?src=libero"
      : "/it/mercato-libero/ticker";
  const supabase = await createServerClient();

  // 1. Latest per ognuno dei 4 slug
  const slugs = AGGREGATE_SLUGS.map((a) => a.slug);
  const latestBySlug = new Map<string, AggregateRow>();

  if (source === "placet") {
    const { data: latest } = await supabase
      .from("energy_index_aggregates")
      .select(
        "aggregate_slug, computed_at, median, p25, p75, min, sample_size, unit",
      )
      .in("aggregate_slug", slugs)
      .order("computed_at", { ascending: false });

    for (const r of (latest ?? []) as AggregateRow[]) {
      if (!latestBySlug.has(r.aggregate_slug))
        latestBySlug.set(r.aggregate_slug, r);
    }
  } else {
    // source === "libero": chiama RPC stats per ognuno dei 4 slug.
    // La RPC ritorna sempre 1 row con counts/percentili NULL se la tabella e' vuota.
    const results = await Promise.all(
      slugs.map(async (slug) => {
        const m = PRICE_MAP[slug];
        const { data } = await supabase.rpc("get_mercato_libero_stats", {
          p_commodity: m.commodity,
          p_price_type: m.price_type,
        });
        const row = Array.isArray(data)
          ? (data[0] as MercatoLiberoStatsRow | undefined)
          : null;
        return { slug, row };
      }),
    );
    for (const { slug, row } of results) {
      if (row && Number(row.n_total) > 0) {
        latestBySlug.set(slug, {
          aggregate_slug: slug,
          computed_at: row.last_updated ?? new Date().toISOString(),
          median: Number(row.median),
          p25: row.p25 !== null ? Number(row.p25) : null,
          p75: row.p75 !== null ? Number(row.p75) : null,
          min: row.best !== null ? Number(row.best) : null,
          sample_size: Number(row.n_total),
          unit: String(row.unit),
          fixed_cost_median:
            row.fixed_cost_median !== null ? Number(row.fixed_cost_median) : null,
          fixed_cost_p25:
            row.fixed_cost_p25 !== null ? Number(row.fixed_cost_p25) : null,
          fixed_cost_p75:
            row.fixed_cost_p75 !== null ? Number(row.fixed_cost_p75) : null,
        });
      }
    }
    // trendBySlug rimane vuoto: no historical data yet per mercato libero.
  }

  const allEmpty =
    source === "libero" &&
    slugs.every((slug) => {
      const r = latestBySlug.get(slug);
      return !r || r.sample_size === 0;
    });

  // 2. Trend ultimi 365 giorni — aggregati ARERA. Solo per source=placet:
  //    mercato_libero non ha ancora storico (ETL/scraper arriva in commit successivi).
  const trendBySlug = new Map<string, Array<{ date: string; value: number }>>();
  if (source === "placet") {
    const oneYearAgo = new Date();
    oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
    const { data: trend } = await supabase
      .from("energy_index_aggregates")
      .select("aggregate_slug, computed_at, median")
      .in("aggregate_slug", slugs)
      .gte("computed_at", oneYearAgo.toISOString().slice(0, 10))
      .order("computed_at", { ascending: true });

    for (const r of (trend ?? []) as Array<{
      aggregate_slug: string;
      computed_at: string;
      median: number;
    }>) {
      const arr = trendBySlug.get(r.aggregate_slug) ?? [];
      arr.push({ date: String(r.computed_at), value: Number(r.median) });
      trendBySlug.set(r.aggregate_slug, arr);
    }
  }

  // 3. Wholesale daily series (PUN + PSV) per calcolare "variabile effettivo".
  //    Bucket = 'day': aggrega media giornaliera dal data orario PUN; PSV e'
  //    gia' daily. Solo per source=placet (libero non ha trend chart).
  let electricSeries: TrendSeries[] = [];
  let gasSeries: TrendSeries[] = [];
  if (source === "placet") {
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
    const buildEffectiveVariable = (
      aggregateSlug: string,
      wholesaleByDate: Map<string, number>,
      conversionFactor: number,
    ): Array<{ date: string; value: number }> => {
      const alphaPoints = trendBySlug.get(aggregateSlug) ?? [];
      const out: Array<{ date: string; value: number }> = [];
      for (const p of alphaPoints) {
        const w = wholesaleByDate.get(p.date);
        if (w === undefined) continue; // skip giorno senza wholesale
        out.push({ date: p.date, value: w * conversionFactor + p.value });
      }
      return out;
    };

    electricSeries = [
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
    gasSeries = [
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
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            breadcrumbList([
              { name: "Home", url: "https://energyindex.it/it" },
              { name: "Mercato Libero", url: "https://energyindex.it/it/mercato-libero" },
            ]),
          ),
        }}
      />
      <header className="space-y-2">
        <h1 className="text-4xl font-bold">Mercato Libero</h1>
        <p className="text-muted-foreground">
          {source === "libero"
            ? "Offerte commerciali mercato libero (non PLACET): media, p25, p75 — fonti API energiapro.biz e scraping brand sites."
            : "Osservatorio statistico delle offerte PLACET pubblicate dal Portale Offerte ARERA. I prezzi mostrati sono la mediana delle offerte attive con quartili p25 e p75."}
        </p>
      </header>

      <SourceToggle active={source} />

      {allEmpty && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center space-y-3">
          <h2 className="text-xl font-bold text-amber-700 dark:text-amber-300">
            Dati mercato libero non-PLACET in arrivo
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Stiamo per attivare due sorgenti: REST API energiapro.biz (offerte
            commerciali raccolte dai mandanti) e scraping dei siti dei
            principali brand (Enel, Edison, Eni Plenitude, Sorgenia, A2A).
            Pubblicheremo i dati appena le pipeline saranno live.
          </p>
          <p className="text-xs text-muted-foreground">
            Le 4 card sotto resteranno vuote finche&apos; i dati non saranno
            popolati.
          </p>
        </div>
      )}

      {source === "placet" && (
        <a
          href={tickerHref}
          className="group relative block overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-black/40 to-transparent p-5 sm:p-6 transition-all hover:-translate-y-0.5 hover:border-emerald-400/60 hover:shadow-xl hover:shadow-emerald-500/20"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-mono uppercase tracking-widest text-emerald-400">
                ▶ Market Map · novità
              </p>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                Visualizza tutte le offerte come mappa interattiva
              </h2>
              <p className="text-sm text-muted-foreground">
                Tutte le 1.500+ offerte PLACET in un colpo d&apos;occhio.
                Cerca un fornitore per nome, identifica al volo dove si colloca
                rispetto al mercato.
              </p>
            </div>
            <span className="hidden sm:inline-block text-2xl text-emerald-400 group-hover:translate-x-1 transition-transform">
              →
            </span>
          </div>
        </a>
      )}

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
              fixedCostMedian={source === "libero" ? row?.fixed_cost_median ?? null : null}
              fixedCostP25={source === "libero" ? row?.fixed_cost_p25 ?? null : null}
              fixedCostP75={source === "libero" ? row?.fixed_cost_p75 ?? null : null}
            />
          );
        })}
      </section>

      {source === "placet" && (
        <>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              Luce — Fissa vs Variabile effettivo (PUN + spread)
            </h2>
            <p className="text-sm text-muted-foreground">
              Confronto giornaliero tra la mediana delle offerte fisse e il
              costo effettivo delle variabili (PUN nazionale del giorno +
              spread mediano ARERA). Per il consumatore: la linea più bassa =
              scelta più conveniente in quel giorno.
            </p>
            <AggregateTrendChart series={electricSeries} unit="€/kWh" />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              Gas — Fissa vs Variabile effettivo (PSV + spread)
            </h2>
            <p className="text-sm text-muted-foreground">
              Confronto giornaliero tra la mediana delle offerte fisse e il
              costo effettivo delle variabili (PSV daily-ahead convertito a
              €/Smc + spread mediano ARERA).
            </p>
            <AggregateTrendChart series={gasSeries} unit="€/Smc" />
          </section>
        </>
      )}

      <FaqSection slug="mercato-libero" />

      <CtaToEnergiapro campaign="mercato-libero" />
    </div>
  );
}
