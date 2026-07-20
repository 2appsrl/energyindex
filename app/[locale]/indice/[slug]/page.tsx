import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { LatestValueCard } from "@/components/LatestValueCard";
import { PriceChart } from "@/components/chart/PriceChart";
import { FaqSection } from "@/components/FaqSection";
import { CtaToEnergiapro } from "@/components/CtaToEnergiapro";
import { TimeframeSelector } from "@/components/chart/TimeframeSelector";
import { resolveTimeframe } from "@/lib/timeframes";
import { resolveZone } from "@/lib/pun-zones";
import { ZoneSelector } from "@/components/chart/ZoneSelector";
import { ZoneMapItalia } from "@/components/chart/ZoneMapItalia";

// La pagina e' dynamic: legge searchParams.tf, quindi Next.js 16 forza
// rendering on-demand e ISR (revalidate) non si applica.
const SUPPORTED_SLUGS = ["pun", "psv"] as const;

const SLUG_DESCRIPTIONS: Record<string, string> = {
  pun: "Prezzo Unico Nazionale del mercato elettrico italiano. Asta MGP del giorno prima, esiti pubblicati intorno alle 12:30.",
  psv: "Punto di Scambio Virtuale, riferimento all'ingrosso del gas naturale italiano. Asta MGP-GAS, esiti pubblicati intorno alle 17:00.",
};

const SOURCE_GRANULARITY_BY_SLUG: Record<string, "hourly" | "daily"> = {
  pun: "hourly",
  psv: "daily",
};

const SLUG_META: Record<string, { title: string; description: string }> = {
  pun: {
    title: "Prezzo PUN oggi — energia elettrica: valore, grafico e storico",
    description:
      "PUN (Prezzo Unico Nazionale) aggiornato ogni giorno dall'asta MGP del GME: prezzo corrente in €/MWh, grafico storico e prezzi delle zone di mercato (Nord, Sud, Sicilia, Sardegna...).",
  },
  psv: {
    title: "Prezzo PSV oggi — gas naturale: valore, grafico e storico",
    description:
      "PSV (Punto di Scambio Virtuale) aggiornato ogni giorno dall'asta MGP-GAS del GME: prezzo all'ingrosso del gas naturale in Italia in €/MWh, con grafico storico e FAQ.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const meta = SLUG_META[slug];
  if (!meta) return {};
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      // Canonical senza query param: le varianti ?tf= e ?zone= sono viste
      // dai crawler come la stessa pagina.
      canonical: `/${locale}/indice/${slug}`,
    },
  };
}

export default async function IndicePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ tf?: string; zone?: string }>;
}) {
  const { slug } = await params;
  const { tf: tfParam, zone: zoneParam } = await searchParams;

  if (!SUPPORTED_SLUGS.includes(slug as (typeof SUPPORTED_SLUGS)[number])) {
    notFound();
  }

  const zone = slug === "pun" ? resolveZone(zoneParam) : null;
  const effectiveSlug = zone ? zone.slug : slug;

  const sourceGranularity = SOURCE_GRANULARITY_BY_SLUG[slug] ?? "hourly";
  const tf = resolveTimeframe(tfParam, sourceGranularity);

  const supabase = await createServerClient();

  const { data: assetMeta } = await supabase
    .from("mv_latest_price_per_asset")
    .select("asset_id, asset_slug, display_name_it, unit, commodity, pricing_kind")
    .eq("asset_slug", effectiveSlug)
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

  // Latest price for big number card: separate query for the last 2 hourly
  // observations <= NOW(). Aggregated bucket queries are not appropriate here
  // (e.g. monthly average is not "current price").
  const nowIso = new Date().toISOString();
  const { data: latestRows } = await supabase
    .from("price_observations")
    .select("observed_at, value")
    .eq("asset_id", assetMeta.asset_id)
    .lte("observed_at", nowIso)
    .order("observed_at", { ascending: false })
    .limit(2);

  const latestPoint = latestRows?.[0]
    ? {
        observed_at: String(latestRows[0].observed_at),
        value: Number(latestRows[0].value),
      }
    : null;
  const prevValue = latestRows?.[1] ? Number(latestRows[1].value) : undefined;

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

  // Bucketed series for the chart, via RPC
  const { data: series } = await supabase.rpc("get_price_series", {
    p_asset_id: assetMeta.asset_id,
    p_interval: tf.intervalSql,
    p_bucket: tf.bucket,
  });
  const points = (series ?? []).map(
    (p: { observed_at: string; value: number | string }) => ({
      observed_at: String(p.observed_at),
      value: Number(p.value),
    }),
  );

  // Description zone-aware: per una zona PUN specifica, descrive il prezzo zonale;
  // per nazionale o PSV usa la descrizione di default dello slug.
  const description =
    zone && !zone.isNational
      ? `Prezzo zonale ${zone.displayShort} derivato dall'asta MGP del Mercato del Giorno Prima (GME). In caso di congestioni di rete, le zone divergono dal PUN nazionale.`
      : (SLUG_DESCRIPTIONS[slug] ?? "");

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

      {zone && (() => {
        const preserveTf = tf.id === "5Y" ? null : tf.id;
        const zoneBasePath = `/it/indice/${slug}`;
        return (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Esplora per zona di mercato</h2>
            <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
              <ZoneMapItalia
                active={zone.code}
                basePath={zoneBasePath}
                preserveTf={preserveTf}
              />
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Il PUN nazionale è la media ponderata sui volumi delle 6 zone fisiche.
                  Le zone possono divergere quando ci sono congestioni di rete.
                </p>
                <ZoneSelector
                  active={zone.code}
                  basePath={zoneBasePath}
                  preserveTf={preserveTf}
                />
              </div>
            </div>
          </section>
        );
      })()}

      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{tf.chartTitle}</h2>
            <p className="text-xs text-muted-foreground">
              {(() => {
                const bucketLabels: Record<typeof tf.bucket, string> = {
                  raw: "Ogni punto = prezzo orario rilevato dal GME.",
                  day: "Ogni punto = media giornaliera. Le ore con prezzi bassi (es. surplus solare di metà giorno) sono mediate con le ore alte serali.",
                  week: "Ogni punto = media settimanale.",
                  month: "Ogni punto = media mensile. La card in alto mostra invece il prezzo dell'ora corrente — può divergere molto dalla media del mese.",
                };
                return bucketLabels[tf.bucket];
              })()}
            </p>
          </div>
          <TimeframeSelector active={tf.id} basePath={`/it/indice/${slug}`} />
        </div>
        <PriceChart key={tf.id} points={points} unit={assetMeta.unit} />
      </section>

      <FaqSection slug={slug} />

      <CtaToEnergiapro campaign={`indice-${slug}`} />
    </div>
  );
}
