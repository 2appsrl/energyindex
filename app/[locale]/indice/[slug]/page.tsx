import type { Metadata } from "next";
import { cache, Suspense } from "react";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { LatestValueCard } from "@/components/LatestValueCard";
import { PriceChart, type OverlaySeries, type PricePoint } from "@/components/chart/PriceChart";
import { FaqSection } from "@/components/FaqSection";
import { CtaToEnergiapro } from "@/components/CtaToEnergiapro";
import { TimeframeSelector } from "@/components/chart/TimeframeSelector";
import { resolveTimeframe } from "@/lib/timeframes";
import { resolveZone } from "@/lib/pun-zones";
import { ZoneSelector } from "@/components/chart/ZoneSelector";
import { ZoneMapItalia } from "@/components/chart/ZoneMapItalia";
import { breadcrumbList, dataset, jsonLdString, organization } from "@/lib/seo/jsonld";
import { ForecastSection } from "@/components/forecast/ForecastSection";

// La pagina e' dynamic: legge searchParams.tf, quindi Next.js 16 forza
// rendering on-demand e ISR (revalidate) non si applica.
const SUPPORTED_SLUGS = ["pun", "psv", "brent", "co2", "temperatura", "ttf"] as const;

// Mappa URL slug -> DB asset slug (alias per URL puliti).
// es. "/it/indice/temperatura" -> asset slug "temperatura-it" in DB.
const URL_TO_ASSET_SLUG: Record<string, string> = {
  temperatura: "temperatura-it",
};

const SLUG_DESCRIPTIONS: Record<string, string> = {
  pun: "Prezzo Unico Nazionale del mercato elettrico italiano. Asta MGP del giorno prima, esiti pubblicati intorno alle 12:30.",
  psv: "Punto di Scambio Virtuale, riferimento all'ingrosso del gas naturale italiano. Asta MGP-GAS, esiti pubblicati intorno alle 17:00.",
  brent: "Prezzo benchmark del petrolio crude oil europeo (North Sea), riferimento globale. Driver storico di gas e elettrico.",
  co2: "Quota di emissione CO2 nell'EU Emissions Trading System. Costo che si scarica sui produttori termoelettrici e indirettamente sulla bolletta.",
  temperatura: "Temperatura media nazionale italiana, media pesata di 9 stazioni meteo per popolazione. Driver dei consumi di gas (riscaldamento) e elettrico (raffrescamento).",
  ttf: "Title Transfer Facility, hub virtuale del gas naturale olandese. Benchmark europeo del gas: il PSV italiano lo segue con spread di 1-3 €/MWh.",
};

const SOURCE_GRANULARITY_BY_SLUG: Record<string, "hourly" | "daily"> = {
  pun: "hourly",
  psv: "daily",
  brent: "daily",
  co2: "daily",
  temperatura: "daily",
  ttf: "daily",
};

// Dataset metadata per JSON-LD, per ogni slug supportato.
const DATASET_DEF: Record<
  string,
  { name: string; description: string; keywords: string[]; temporalCoverage: string }
> = {
  pun: {
    name: "PUN — Prezzo Unico Nazionale (Italia)",
    description:
      "Serie storica del Prezzo Unico Nazionale dell'energia elettrica italiana, asta MGP del giorno prima. Dati orari dal 2021.",
    keywords: [
      "PUN",
      "Prezzo Unico Nazionale",
      "energia elettrica",
      "Italia",
      "GME",
      "MGP",
      "day-ahead",
    ],
    temporalCoverage: "2021-05-07/..",
  },
  psv: {
    name: "PSV — Punto di Scambio Virtuale gas (Italia)",
    description:
      "Serie storica del prezzo PSV per il gas naturale italiano, asta MGP-GAS. Dati giornalieri dal 2021.",
    keywords: [
      "PSV",
      "Punto di Scambio Virtuale",
      "gas naturale",
      "Italia",
      "GME",
      "MGP-GAS",
    ],
    temporalCoverage: "2021-05-07/..",
  },
  brent: {
    name: "Brent — Petrolio greggio (spot)",
    description:
      "Serie storica del prezzo Brent crude oil (North Sea), benchmark europeo del petrolio. Dati giornalieri dall'EIA Open Data.",
    keywords: ["Brent", "petrolio", "oil", "crude", "EIA", "commodity"],
    temporalCoverage: "2016-05-13/..",
  },
  co2: {
    name: "CO2 EUA — Quota emissione EU ETS",
    description:
      "Serie storica del prezzo settlement giornaliero del future EUA (EU Emissions Trading System). Driver del costo elettrico termoelettrico.",
    keywords: ["CO2", "EUA", "EU ETS", "carbon", "emissioni", "quota"],
    temporalCoverage: "2021-05-13/..",
  },
  temperatura: {
    name: "Temperatura Italia (media nazionale)",
    description:
      "Serie storica della temperatura media giornaliera in Italia, media pesata di 9 stazioni meteo. Driver dei consumi gas/elettrici.",
    keywords: ["temperatura", "Italia", "meteo", "HDD", "CDD", "consumi", "clima"],
    temporalCoverage: "2021-05-13/..",
  },
  ttf: {
    name: "TTF — Gas Europa (front-month future)",
    description:
      "Serie storica del prezzo Title Transfer Facility, benchmark europeo del gas naturale. Front-month future, fonte ICE Endex. Il PSV italiano insegue il TTF con spread tipico 1-3 €/MWh.",
    keywords: [
      "TTF",
      "Title Transfer Facility",
      "gas naturale",
      "Europa",
      "ICE Endex",
      "front-month",
      "future",
    ],
    temporalCoverage: "2018-05-13/..",
  },
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

const toPoints = (rows: unknown): PricePoint[] =>
  ((rows ?? []) as { observed_at: string; value: number | string }[]).map((p) => ({
    observed_at: String(p.observed_at),
    value: Number(p.value),
  }));

/**
 * Serie TTF da sovrapporre al chart PSV: rende visibile lo spread TTF→PSV
 * (driver Europa vs hub italiano). Ritorna null se il TTF non ha dati.
 *
 * Estratta a funzione per poter girare in parallelo con la serie principale:
 * i suoi due round trip verso Supabase erano in coda a quelli della pagina.
 */
async function loadTtfOverlay(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  tf: { intervalSql: string; bucket: string },
): Promise<OverlaySeries | null> {
  const { data: ttfMeta } = await getAssetMetaBySlug("ttf");
  if (!ttfMeta?.asset_id) return null;
  const { data: ttfSeries } = await supabase.rpc("get_price_series", {
    p_asset_id: ttfMeta.asset_id,
    p_interval: tf.intervalSql,
    p_bucket: tf.bucket,
  });
  const points = toPoints(ttfSeries);
  if (points.length === 0) return null;
  return {
    label: "TTF Europa",
    color: "#f59e0b", // amber-500 — netto contrasto col verde principale
    points,
  };
}

/** Placeholder del blocco forecast mentre la sua RPC e' ancora in volo. */
function ForecastSkeleton() {
  return (
    <section aria-busy="true" className="space-y-3">
      <div className="h-6 w-56 rounded-md bg-muted animate-pulse" />
      <div className="h-[300px] w-full rounded-lg border bg-muted/50 animate-pulse" />
      <span className="sr-only">Caricamento previsioni in corso.</span>
    </section>
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ zone?: string; fh?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { zone: zoneParam } = await searchParams;
  if (!SUPPORTED_SLUGS.includes(slug as (typeof SUPPORTED_SLUGS)[number])) {
    return { title: "Indice non trovato" };
  }
  const zone = slug === "pun" ? resolveZone(zoneParam) : null;
  const effectiveAssetSlug = zone ? zone.slug : (URL_TO_ASSET_SLUG[slug] ?? slug);

  // Lookup ultimo prezzo per il title dinamico (via mv_latest_price_per_asset
  // per recuperare asset_id, poi price_observations). Helpers memoizzati via
  // React.cache: condividono la stessa promise con IndicePage in questa request.
  let price: number | null = null;
  let unit = "€/MWh";
  try {
    const { data: metaRow } = await getAssetMetaBySlug(effectiveAssetSlug);
    if (metaRow?.unit) unit = String(metaRow.unit);
    if (metaRow?.asset_id) {
      const { data: rows } = await getLatestObservations(metaRow.asset_id, 1);
      if (rows?.[0]) price = Number(rows[0].value);
    }
  } catch {
    // fallback: metadata senza prezzo (priceStr = "—")
  }
  const priceStr = price !== null ? `${NUMBER_2DP.format(price)} ${unit}` : "—";

  // Date string per title/description — boost CTR + freshness signal
  // su query "X oggi" che sono le piu' competitive del settore.
  const today = new Date();
  const ddmm = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}`;
  const valueOnly = price !== null ? NUMBER_2DP.format(price) : null;

  let title: string;
  let description: string;
  if (slug === "pun") {
    const zoneLabel = zone && !zone.isNational ? ` Zona ${zone.displayShort}` : "";
    title = valueOnly
      ? `PUN${zoneLabel} oggi ${valueOnly} €/MWh (${ddmm}) — GME`
      : `PUN${zoneLabel} oggi: ${priceStr}`;
    description = valueOnly
      ? `Valore PUN${zoneLabel} oggi ${valueOnly} €/MWh aggiornato il ${ddmm}. Storico 5 anni, forecast 90 giorni, dato live GME (Gestore Mercati Energetici). Gratis, no registrazione.`
      : `Andamento e prezzo attuale del PUN${zoneLabel}, riferimento all'ingrosso dell'energia elettrica italiana. Storico 5 anni, aggiornato ogni ora dal GME.`;
  } else if (slug === "psv") {
    title = valueOnly
      ? `PSV oggi ${valueOnly} €/MWh (${ddmm}) — Gas Italia GME`
      : `PSV oggi: ${priceStr} — Punto di Scambio Virtuale gas`;
    description = valueOnly
      ? `Valore PSV oggi ${valueOnly} €/MWh aggiornato il ${ddmm}. Prezzo all'ingrosso gas naturale Italia, riferimento offerte gas variabili. Storico, forecast e dato live GME MGP-GAS.`
      : "Andamento del PSV (Punto di Scambio Virtuale), prezzo all'ingrosso del gas naturale italiano. Storico 5 anni, aggiornato ogni giorno dal GME MGP-GAS.";
  } else if (slug === "brent") {
    title = valueOnly
      ? `Brent oggi ${valueOnly} $/bbl (${ddmm}) — Petrolio`
      : `Brent oggi: ${priceStr} — Petrolio greggio`;
    description = valueOnly
      ? `Valore Brent oggi ${valueOnly} $/bbl aggiornato il ${ddmm}. Benchmark europeo petrolio (North Sea), driver storico di gas ed elettrico.`
      : "Andamento del prezzo Brent crude oil (North Sea), benchmark europeo del petrolio. Driver storico dei prezzi gas ed elettrico.";
  } else if (slug === "co2") {
    title = valueOnly
      ? `CO2 EUA oggi ${valueOnly} €/tCO2 (${ddmm}) — EU ETS`
      : `CO2 EUA oggi: ${priceStr} — Quota emissione EU ETS`;
    description = valueOnly
      ? `Valore CO2 EUA oggi ${valueOnly} €/tCO2 aggiornato il ${ddmm}. Quota emissione EU ETS, costo per produttori termoelettrici, impatto su bolletta.`
      : "Prezzo settlement della quota di emissione CO2 nell'EU Emissions Trading System. Costo per i produttori termoelettrici, impatta indirettamente la bolletta elettrica.";
  } else if (slug === "ttf") {
    title = valueOnly
      ? `TTF oggi ${valueOnly} €/MWh (${ddmm}) — Gas Europa`
      : `TTF oggi: ${priceStr} — Gas Europa (front-month)`;
    description = valueOnly
      ? `Valore TTF oggi ${valueOnly} €/MWh aggiornato il ${ddmm}. Title Transfer Facility, benchmark europeo gas naturale (front-month ICE Endex). Driver principale del PSV italiano.`
      : "Andamento del TTF (Title Transfer Facility), benchmark europeo del gas naturale. Driver principale del PSV italiano.";
  } else {
    // temperatura
    title = `Temperatura Italia oggi: ${priceStr}`;
    description =
      "Temperatura media nazionale italiana (media pesata di 9 citta'), driver dei consumi gas e elettrici. Anomalia stagionale vs media 5 anni.";
  }

  // Keywords per-slug, specifiche per query high-intent
  const slugKeywords: Record<string, string[]> = {
    pun: [
      "PUN",
      "PUN oggi",
      "valore PUN",
      "PUN GME",
      "prezzo PUN",
      "PUN energia",
      "PUN mercato elettrico",
      "PUN MGP",
      "PUN day-ahead",
      ...(zone && !zone.isNational
        ? [`PUN ${zone.displayShort}`, `PUN zona ${zone.displayShort}`]
        : []),
    ],
    psv: [
      "PSV",
      "PSV oggi",
      "valore PSV",
      "PSV gas",
      "PSV GME",
      "prezzo PSV",
      "PSV Italia",
      "Punto di Scambio Virtuale",
      "PSV MGP-GAS",
      "PSV gas naturale",
    ],
    ttf: ["TTF", "TTF oggi", "valore TTF", "TTF gas", "TTF ICE", "TTF Europa", "gas Europa"],
    brent: ["Brent", "Brent oggi", "petrolio oggi", "prezzo Brent", "North Sea"],
    co2: ["CO2 EUA", "CO2 oggi", "EU ETS", "quota emissione", "CO2 prezzo"],
    temperatura: ["temperatura Italia", "anomalia temperatura", "clima Italia"],
  };

  return {
    title,
    description,
    keywords: slugKeywords[slug],
    alternates: {
      canonical:
        zone && !zone.isNational
          ? `https://energyindex.it/it/indice/${slug}?zone=${zone.code}`
          : `https://energyindex.it/it/indice/${slug}`,
    },
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
    other: {
      googlebot:
        "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
    },
  };
}

export default async function IndicePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ tf?: string; zone?: string; fh?: string }>;
}) {
  const { slug } = await params;
  const { tf: tfParam, zone: zoneParam, fh: fhParam } = await searchParams;

  const validHorizons = [7, 30, 90, 180];
  const requestedH = fhParam ? Number(fhParam) : 30;
  const forecastHorizon = validHorizons.includes(requestedH) ? requestedH : 30;

  if (!SUPPORTED_SLUGS.includes(slug as (typeof SUPPORTED_SLUGS)[number])) {
    notFound();
  }

  const zone = slug === "pun" ? resolveZone(zoneParam) : null;
  const effectiveAssetSlug = zone ? zone.slug : (URL_TO_ASSET_SLUG[slug] ?? slug);

  const sourceGranularity = SOURCE_GRANULARITY_BY_SLUG[slug] ?? "hourly";
  const tf = resolveTimeframe(tfParam, sourceGranularity);

  const { data: assetMeta } = await getAssetMetaBySlug(effectiveAssetSlug);

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

  const supabase = await createServerClient();

  // Serie principale, anomalia temperatura e overlay TTF sono indipendenti:
  // partono insieme. In sequenza ognuna aggiungeva il suo round trip Supabase
  // al TTFB (PSV pagava 2 query extra per l'overlay, ~4.5s a freddo).
  const [seriesRes, anomalyRes, ttfOverlay] = await Promise.all([
    supabase.rpc("get_price_series", {
      p_asset_id: assetMeta.asset_id,
      p_interval: tf.intervalSql,
      p_bucket: tf.bucket,
    }),
    slug === "temperatura"
      ? supabase.rpc("get_temperature_anomaly", {
          p_date: latestPoint.observed_at.slice(0, 10),
        })
      : Promise.resolve(null),
    // Overlay solo per PSV: il confronto TTF↔PSV non ha senso sugli altri indici.
    slug === "psv" ? loadTtfOverlay(supabase, tf) : Promise.resolve(null),
  ]);

  const points = toPoints(seriesRes.data);

  // Per temperatura: anomalia = delta vs media 5 anni stesso giorno.
  let temperatureAnomaly: { anomaly: number | null; baseline_years: number } | null = null;
  const anomRow = Array.isArray(anomalyRes?.data) ? anomalyRes.data[0] : null;
  if (anomRow) {
    temperatureAnomaly = {
      anomaly: anomRow.anomaly ?? null,
      baseline_years: anomRow.baseline_years ?? 0,
    };
  }

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
              ...DATASET_DEF[slug],
              url: `https://energyindex.it/it/indice/${slug}`,
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
      {/* NewsArticle JSON-LD per le 3 commodity di mercato (PUN/PSV/TTF)
          + Brent/CO2 — google interpreta la pagina come "news" con
          datePublished/dateModified freschi → freshness boost continuo
          per query high-intent come "PUN oggi" / "PSV oggi". */}
      {(slug === "pun" || slug === "psv" || slug === "ttf" || slug === "brent" || slug === "co2") && latestPoint && (() => {
        const today = new Date();
        const ddmmyyyy = today.toLocaleDateString("it-IT", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });
        const labelMap: Record<string, string> = {
          pun: "PUN",
          psv: "PSV gas",
          ttf: "TTF gas Europa",
          brent: "Brent petrolio",
          co2: "CO2 EUA",
        };
        const label = labelMap[slug];
        const valueFmt = NUMBER_2DP.format(latestPoint.value);
        const newsArticleJsonLd = {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: `${label} oggi ${valueFmt} ${assetMeta.unit} (${ddmmyyyy})`,
          description: `Il valore ${label} oggi e' ${valueFmt} ${assetMeta.unit}, aggiornato il ${ddmmyyyy}. Storico, forecast e dato live.`,
          image: `https://energyindex.it/it/indice/${slug}/opengraph-image`,
          datePublished: latestPoint.observed_at,
          dateModified: today.toISOString(),
          author: organization(),
          publisher: organization(),
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": `https://energyindex.it/it/indice/${slug}`,
          },
          inLanguage: "it-IT",
        };
        // FAQPage one-question targeted: la risposta diretta alla query
        // di ricerca "{INDICE} oggi" — Google AI Overview la cita come
        // featured snippet con valore numerico.
        const todayFaqJsonLd = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: `Quanto vale il ${label} oggi?`,
              acceptedAnswer: {
                "@type": "Answer",
                text: `Il valore ${label} oggi e' ${valueFmt} ${assetMeta.unit}, aggiornato il ${ddmmyyyy}. Il dato e' pubblicato in tempo reale su energyindex.it dalla fonte ufficiale.`,
              },
            },
            {
              "@type": "Question",
              name: `Qual e' il valore ${label} oggi?`,
              acceptedAnswer: {
                "@type": "Answer",
                text: `${label}: ${valueFmt} ${assetMeta.unit} (aggiornato ${ddmmyyyy}).`,
              },
            },
          ],
        };
        // WebPage + SpeakableSpecification: per Google Assistant / Siri
        // / Apple Intelligence che cercano la risposta vocale alla query
        // "Quanto vale il PUN oggi?" — leggono solo l'H1 e la card valore.
        const webPageJsonLd = {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `https://energyindex.it/it/indice/${slug}`,
          url: `https://energyindex.it/it/indice/${slug}`,
          name: `${label} oggi ${valueFmt} ${assetMeta.unit}`,
          description: `Valore ${label} attuale: ${valueFmt} ${assetMeta.unit}, aggiornato ${ddmmyyyy}.`,
          inLanguage: "it-IT",
          isPartOf: {
            "@type": "WebSite",
            "@id": "https://energyindex.it",
            name: "Energy Index",
          },
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: [".speakable-headline", ".speakable-value"],
          },
          datePublished: latestPoint.observed_at,
          dateModified: today.toISOString(),
          publisher: organization(),
        };
        return (
          <>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: jsonLdString(newsArticleJsonLd) }}
            />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: jsonLdString(todayFaqJsonLd) }}
            />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: jsonLdString(webPageJsonLd) }}
            />
            {/* Frase speakable nascosta ottimizzata per voice-readback
                degli AI Assistant. NON visibile a schermo (sr-only) per
                evitare duplicazione UX con LatestValueCard sotto. */}
            <p className="speakable-value sr-only">
              Il valore {label} oggi, {ddmmyyyy}, e&apos; {valueFmt} {assetMeta.unit},
              aggiornato in tempo reale dalla fonte ufficiale.
            </p>
          </>
        );
      })()}
      <header className="space-y-2">
        <h1 className="speakable-headline text-4xl font-bold tabular-nums">
          {assetMeta.display_name_it}
        </h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </header>

      <LatestValueCard
        display_name={assetMeta.display_name_it}
        value={latestPoint.value}
        prev_value={slug === "temperatura" ? undefined : prevValue}
        unit={assetMeta.unit}
        observed_at={latestPoint.observed_at}
        commodity={slug === "pun" ? "luce" : slug === "psv" ? "gas" : undefined}
        anomaly={
          slug === "temperatura" && temperatureAnomaly && temperatureAnomaly.baseline_years >= 3
            ? temperatureAnomaly.anomaly
            : undefined
        }
        baselineLabel={
          slug === "temperatura" && temperatureAnomaly && temperatureAnomaly.baseline_years >= 3
            ? `vs media ${new Date().getFullYear() - 5}-${new Date().getFullYear() - 1}`
            : undefined
        }
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
                  raw:
                    slug === "pun"
                      ? "Ogni punto = prezzo orario rilevato dal GME."
                      : "Ogni punto = valore puntuale.",
                  day: "Ogni punto = media giornaliera.",
                  week: "Ogni punto = media settimanale.",
                  month: "Ogni punto = media mensile.",
                };
                return bucketLabels[tf.bucket];
              })()}
            </p>
          </div>
          <TimeframeSelector active={tf.id} basePath={`/it/indice/${slug}`} />
        </div>
        {ttfOverlay && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm bg-emerald-500" />
              PSV (Italia)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm bg-amber-500" />
              TTF (Europa)
            </span>
          </div>
        )}
        <PriceChart
          key={tf.id}
          points={points}
          unit={assetMeta.unit}
          overlay={ttfOverlay ?? undefined}
        />
      </section>

      {/* Suspense: la RPC del forecast non deve trattenere prezzo e grafico.
          Il resto della pagina viene inviato subito, il forecast arriva in
          streaming quando pronto. */}
      {(slug === "pun" || slug === "psv" || slug === "ttf") && (
        <Suspense fallback={<ForecastSkeleton />}>
          <ForecastSection
            assetSlug={slug}
            assetId={Number(assetMeta.asset_id)}
            unit={assetMeta.unit}
            horizonDays={forecastHorizon}
          />
        </Suspense>
      )}

      <FaqSection slug={slug} />

      <CtaToEnergiapro campaign={`indice-${slug}`} />
    </div>
  );
}
