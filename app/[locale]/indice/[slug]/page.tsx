import type { Metadata } from "next";
import { cache } from "react";
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
import { breadcrumbList, dataset, jsonLdString } from "@/lib/seo/jsonld";

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

const NUMBER_2DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Lookup `asset_id` per asset_slug usando mv_latest_price_per_asset.
 * Memoizzato a livello di richiesta via React.cache cosi' generateMetadata e
 * IndicePage non duplicano la stessa query Supabase.
 */
const getAssetMetaBySlug = cache(async (slug: string) => {
  const supabase = await createServerClient();
  return supabase
    .from("mv_latest_price_per_asset")
    .select("asset_id, asset_slug, display_name_it, unit, commodity, pricing_kind")
    .eq("asset_slug", slug)
    .maybeSingle();
});

/**
 * Recupera le ultime N osservazioni <= ora corrente per un asset_id.
 * Memoizzato per richiesta. Default limit=2 (serve sia per latest, sia per
 * delta vs precedente nella card).
 */
const getLatestObservations = cache(async (assetId: string | number, limit = 2) => {
  const supabase = await createServerClient();
  const nowIso = new Date().toISOString();
  return supabase
    .from("price_observations")
    .select("observed_at, value")
    .eq("asset_id", assetId)
    .lte("observed_at", nowIso)
    .order("observed_at", { ascending: false })
    .limit(limit);
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ zone?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { zone: zoneParam } = await searchParams;
  if (!SUPPORTED_SLUGS.includes(slug as (typeof SUPPORTED_SLUGS)[number])) {
    return { title: "Indice non trovato" };
  }
  const zone = slug === "pun" ? resolveZone(zoneParam) : null;
  const effectiveSlug = zone ? zone.slug : slug;

  // Lookup ultimo prezzo per il title dinamico (via mv_latest_price_per_asset
  // per recuperare asset_id, poi price_observations). Helpers memoizzati via
  // React.cache: condividono la stessa promise con IndicePage in questa request.
  let price: number | null = null;
  try {
    const { data: metaRow } = await getAssetMetaBySlug(effectiveSlug);
    if (metaRow?.asset_id) {
      const { data: rows } = await getLatestObservations(metaRow.asset_id, 1);
      if (rows?.[0]) price = Number(rows[0].value);
    }
  } catch {
    // fallback: metadata senza prezzo (priceStr = "—")
  }
  const priceStr = price !== null ? `${NUMBER_2DP.format(price)} €/MWh` : "—";

  const isPun = slug === "pun";
  const zoneLabel = zone && !zone.isNational ? ` Zona ${zone.displayShort}` : "";

  const title = isPun
    ? `PUN${zoneLabel} oggi: ${priceStr}`
    : `PSV oggi: ${priceStr} — Punto di Scambio Virtuale gas`;

  const description = isPun
    ? `Andamento e prezzo attuale del PUN${zoneLabel}, riferimento all'ingrosso dell'energia elettrica italiana. Storico 5 anni, aggiornato ogni ora dal GME.`
    : "Andamento del PSV (Punto di Scambio Virtuale), prezzo all'ingrosso del gas naturale italiano. Storico 5 anni, aggiornato ogni giorno dal GME MGP-GAS.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "it_IT",
      url: zone && !zone.isNational
        ? `/it/indice/${slug}?zone=${zone.code}`
        : `/it/indice/${slug}`,
    },
    twitter: { card: "summary_large_image", title, description },
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

  const { data: assetMeta } = await getAssetMetaBySlug(effectiveSlug);

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
  const { data: latestRows } = await getLatestObservations(assetMeta.asset_id, 2);

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
  const supabase = await createServerClient();
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            dataset({
              name:
                slug === "pun"
                  ? "PUN — Prezzo Unico Nazionale (Italia)"
                  : "PSV — Punto di Scambio Virtuale gas (Italia)",
              description:
                slug === "pun"
                  ? "Serie storica del Prezzo Unico Nazionale dell'energia elettrica italiana, asta MGP del giorno prima. Dati orari dal 2021."
                  : "Serie storica del prezzo PSV per il gas naturale italiano, asta MGP-GAS. Dati giornalieri dal 2021.",
              url: `https://energyindex.it/it/indice/${slug}`,
              keywords:
                slug === "pun"
                  ? ["PUN", "Prezzo Unico Nazionale", "energia elettrica", "Italia", "GME", "MGP", "day-ahead"]
                  : ["PSV", "Punto di Scambio Virtuale", "gas naturale", "Italia", "GME", "MGP-GAS"],
              temporalCoverage: "2021-05-07/..",
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            breadcrumbList([
              { name: "Home", url: "https://energyindex.it/it" },
              { name: assetMeta.display_name_it, url: `https://energyindex.it/it/indice/${slug}` },
            ]),
          ),
        }}
      />
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
