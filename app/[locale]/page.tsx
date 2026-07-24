import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { PriceShowcaseCard } from "@/components/home/PriceShowcaseCard";
import { MarketBanner } from "@/components/home/MarketBanner";
import { DriverCard } from "@/components/home/DriverCard";
import { Droplets, Flame as FlameIcon, Leaf, Thermometer } from "lucide-react";
import { jsonLdString, organization } from "@/lib/seo/jsonld";

const SITE = "https://energyindex.it";

/** Formattazione numerica it-IT consistente (lato server + render). */
function formatValue(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

/** Fetch del valore corrente PUN — wrappato in React.cache cosi' la
 *  stessa chiamata da generateMetadata e HomeIt non duplica la query. */
const fetchPunLatest = cache(async (): Promise<{ value: number | null; unit: string; observedAt: string | null }> => {
  const supabase = await createServerClient();
  const { data: meta } = await supabase
    .from("mv_latest_price_per_asset")
    .select("asset_id, unit, observed_at")
    .eq("asset_slug", "pun")
    .maybeSingle();
  if (!meta) return { value: null, unit: "€/MWh", observedAt: null };
  const { data: rows } = await supabase
    .from("price_observations")
    .select("value, observed_at")
    .eq("asset_id", meta.asset_id)
    .order("observed_at", { ascending: false })
    .limit(1);
  return {
    value: rows?.[0] ? Number(rows[0].value) : null,
    unit: (meta.unit as string) ?? "€/MWh",
    observedAt: rows?.[0]?.observed_at ?? (meta.observed_at as string | null),
  };
});

/**
 * Dynamic SEO metadata: il titolo include il VALORE PUN del giorno + la
 * data corrente. Cambia ogni giorno → freshness signal per Google +
 * magnete CTR in SERP ("PUN oggi 105,23 €/MWh" attrae piu' di
 * "PUN oggi — Prezzo PUN energia..."). Stesso URL canonical, niente
 * sitemap explosion.
 */
export async function generateMetadata(): Promise<Metadata> {
  const pun = await fetchPunLatest();
  const today = new Date();
  const ddmm = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}`;
  const valueStr = pun.value !== null ? formatValue(pun.value) : null;
  // Niente suffisso "| Energy Index": lo aggiunge gia' il template del root layout.
  const title = valueStr
    ? `PUN oggi ${valueStr} €/MWh (${ddmm}) — Prezzo energia`
    : "PUN oggi — Prezzo PUN energia elettrica in tempo reale";
  const description = valueStr
    ? `PUN oggi ${valueStr} €/MWh aggiornato ${ddmm}. Valore PUN per zona (Nord, CNord, CSud, Sud, Sicilia, Sardegna), PSV gas, TTF + forecast 7-180 giorni + offerte mercato libero ARERA. Gratis, no registrazione.`
    : "PUN oggi: prezzo energia elettrica all'ingrosso in tempo reale (GME). Forecast PUN/PSV/TTF a 7/30/90/180 giorni con track record verificabile. Offerte mercato libero ARERA. Gratis.";

  return {
    title,
    description,
    keywords: [
      "PUN",
      "PUN oggi",
      "valore PUN",
      "PUN energia",
      "PUN GME",
      "PUN Nord",
      "PUN Sud",
      "PUN Sicilia",
      "PUN Sardegna",
      "prezzo PUN",
      "prezzo energia elettrica",
      "PSV",
      "PSV gas",
      "valore PSV",
      "TTF",
      "TTF gas",
      "mercato elettrico",
      "GME mercato elettrico",
      "MGP",
      "mercato libero energia",
      "forecast PUN",
      "previsione PUN",
      "energy index",
    ],
    alternates: { canonical: `${SITE}/it` },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "it_IT",
      url: "/it",
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: valueStr ? `PUN oggi ${valueStr} €/MWh — Energy Index` : "PUN oggi — Energy Index",
      description: valueStr
        ? `PUN ${valueStr} €/MWh. PSV gas, TTF, forecast e offerte ARERA su energyindex.it`
        : "PUN GME + forecast + offerte ARERA, gratis su energyindex.it",
      images: ["/opengraph-image"],
    },
    other: {
      // Robots: massima freschezza, no cache lunga
      "googlebot": "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
    },
  };
}

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

async function getDriverLatest(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  slug: string,
): Promise<{ value: number | null; prevValue: number | null; unit: string }> {
  return getLatestPair(supabase, slug);
}

async function getTemperatureAnomaly(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<{ value: number | null; anomaly: number | null; baseline_years: number }> {
  const { data } = await supabase.rpc("get_temperature_anomaly");
  const row = Array.isArray(data) ? data[0] : null;
  return {
    value: row?.value ?? null,
    anomaly: row?.anomaly ?? null,
    baseline_years: row?.baseline_years ?? 0,
  };
}

/** PUN per zona (6 zone GME). Long-tail SEO: "PUN Nord", "PUN Sicilia". */
const ZONE_DEFS = [
  { slug: "pun-zona-nord", label: "Nord", code: "nord" },
  { slug: "pun-zona-cnor", label: "Centro-Nord", code: "cnor" },
  { slug: "pun-zona-csud", label: "Centro-Sud", code: "csud" },
  { slug: "pun-zona-sud", label: "Sud", code: "sud" },
  { slug: "pun-zona-sici", label: "Sicilia", code: "sici" },
  { slug: "pun-zona-sard", label: "Sardegna", code: "sard" },
] as const;

async function getZonePrices(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<Array<{ label: string; code: string; value: number | null; prevValue: number | null }>> {
  const results = await Promise.all(
    ZONE_DEFS.map(async (z) => {
      const pair = await getLatestPair(supabase, z.slug);
      return { label: z.label, code: z.code, value: pair.value, prevValue: pair.prevValue };
    }),
  );
  return results;
}

export default async function HomeIt() {
  const supabase = await createServerClient();
  // fetchPunLatest e' cached → riutilizziamo la stessa fetch fatta da generateMetadata
  const [punLatest, pun, psv, market, brent, co2, tempAnom, ttf, zones] =
    await Promise.all([
      fetchPunLatest(),
      getLatestPair(supabase, "pun"),
      getLatestPair(supabase, "psv"),
      getMarketBannerData(supabase),
      getDriverLatest(supabase, "brent"),
      getDriverLatest(supabase, "co2"),
      getTemperatureAnomaly(supabase),
      getDriverLatest(supabase, "ttf"),
      getZonePrices(supabase),
    ]);

  const todayDate = new Date();
  const todayIso = todayDate.toISOString().slice(0, 10);
  const ddmmyyyy = todayDate.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const observedIso = punLatest.observedAt ?? todayDate.toISOString();
  const punStr = pun.value !== null ? formatValue(pun.value) : null;
  const psvStr = psv.value !== null ? formatValue(psv.value) : null;
  const ttfStr = ttf.value !== null ? formatValue(ttf.value) : null;

  // SEO #1: FAQ JSON-LD esteso → rich snippets su Google + voice search
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Cos'è il PUN energia?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Il PUN (Prezzo Unico Nazionale) è il prezzo all'ingrosso dell'energia elettrica in Italia, calcolato giornalmente dal GME (Gestore dei Mercati Energetici) sulla base degli scambi nel mercato del giorno prima (MGP). È espresso in €/MWh ed è il riferimento per le offerte luce indicizzate del mercato libero.",
        },
      },
      {
        "@type": "Question",
        name: "Qual è il valore PUN oggi?",
        acceptedAnswer: {
          "@type": "Answer",
          text: punStr
            ? `Il PUN oggi è ${punStr} €/MWh. Aggiornato in tempo reale su energyindex.it dalle pubblicazioni ufficiali del GME.`
            : "Il valore PUN più recente è visualizzato in tempo reale sul nostro sito, aggiornato dalle pubblicazioni ufficiali del GME.",
        },
      },
      {
        "@type": "Question",
        name: "Come si calcola il PUN?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Il PUN è la media ponderata dei prezzi zonali (Nord, Centro-Nord, Centro-Sud, Sud, Sicilia, Sardegna) sui volumi di acquisto effettivi nel mercato del giorno prima. Viene pubblicato ogni giorno dal GME dopo la chiusura della sessione MGP.",
        },
      },
      {
        "@type": "Question",
        name: "Quanto vale il PUN al Nord oggi?",
        acceptedAnswer: {
          "@type": "Answer",
          text: (() => {
            const nord = zones.find((z) => z.code === "nord")?.value;
            return nord !== null && nord !== undefined
              ? `Il PUN della zona Nord è ${formatValue(nord)} €/MWh. Tutti i valori zonali (Nord, Centro-Nord, Centro-Sud, Sud, Sicilia, Sardegna) sono pubblicati in tempo reale su energyindex.it.`
              : "I valori del PUN per le 6 zone (Nord, Centro-Nord, Centro-Sud, Sud, Sicilia, Sardegna) sono pubblicati in tempo reale su energyindex.it.";
          })(),
        },
      },
      {
        "@type": "Question",
        name: "Quando viene pubblicato il PUN?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Il PUN viene pubblicato dal GME ogni giorno entro le ore 11:30, dopo la chiusura della sessione MGP del mercato del giorno prima. Su energyindex.it il valore aggiornato è disponibile in pochi minuti dalla pubblicazione GME.",
        },
      },
      {
        "@type": "Question",
        name: "Cos'è il PSV nel mercato gas?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Il PSV (Punto di Scambio Virtuale) è il prezzo all'ingrosso del gas naturale in Italia, pubblicato dal GME. È il riferimento per le offerte gas variabili del mercato libero. Si esprime in €/MWh.",
        },
      },
      {
        "@type": "Question",
        name: "Qual è il valore PSV oggi?",
        acceptedAnswer: {
          "@type": "Answer",
          text: psvStr
            ? `Il PSV oggi è ${psvStr} €/MWh. Aggiornato in tempo reale su energyindex.it dalle pubblicazioni ufficiali del GME.`
            : "Il valore PSV più recente è visualizzato in tempo reale sul nostro sito, aggiornato dalle pubblicazioni GME.",
        },
      },
      {
        "@type": "Question",
        name: "Che cos'è il TTF gas?",
        acceptedAnswer: {
          "@type": "Answer",
          text: ttfStr
            ? `Il TTF (Title Transfer Facility) è il benchmark europeo del gas naturale, quotato ad Amsterdam (ICE). Oggi vale ${ttfStr} €/MWh. È il riferimento internazionale dei contratti gas in Europa e influisce direttamente sui prezzi PSV italiani.`
            : "Il TTF (Title Transfer Facility) è il benchmark europeo del gas naturale, quotato ad Amsterdam (ICE). È il riferimento internazionale dei contratti gas in Europa e influisce direttamente sui prezzi PSV italiani.",
        },
      },
      {
        "@type": "Question",
        name: "Posso prevedere il PUN futuro?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Su Energy Index pubblichiamo forecast PUN giornalieri a 7, 30, 90 e 180 giorni, generati con modello Ridge regression calibrato via conformal prediction. Tracciamo l'accuratezza in modo trasparente nella pagina Track Record.",
        },
      },
      {
        "@type": "Question",
        name: "Energyindex.it è gratuito?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sì. Tutti i dati PUN, PSV, TTF, le tabelle zonali, i forecast a 7-180 giorni e la mappa di tutte le offerte del mercato libero sono accessibili gratuitamente, senza registrazione né limiti.",
        },
      },
    ],
  };

  // SEO #2: Dataset JSON-LD per il flusso PUN — Google indicizza come fonte dati
  const punDatasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "PUN — Prezzo Unico Nazionale energia elettrica Italia",
    description:
      "Serie temporale del Prezzo Unico Nazionale (PUN) dell'energia elettrica italiana, pubblicato giornalmente dal GME dopo la sessione MGP del mercato del giorno prima. Aggiornato in tempo reale + 6 zone (Nord, Centro-Nord, Centro-Sud, Sud, Sicilia, Sardegna).",
    url: `${SITE}/it/indice/pun`,
    keywords:
      "PUN, prezzo unico nazionale, energia elettrica, GME, mercato elettrico, MGP, PUN oggi, valore PUN, PUN zonale",
    license: "https://www.gme.it/it-it/Legal/CondizioniUtilizzo",
    isAccessibleForFree: true,
    temporalCoverage: `2022-01-01/${todayIso}`,
    spatialCoverage: { "@type": "Place", name: "Italia" },
    variableMeasured: {
      "@type": "PropertyValue",
      name: "PUN (Prezzo Unico Nazionale)",
      unitText: "€/MWh",
      unitCode: "EUR-MWH",
      value: pun.value,
    },
    publisher: organization(),
    creator: {
      "@type": "Organization",
      name: "GME — Gestore dei Mercati Energetici",
      url: "https://www.mercatoelettrico.org",
    },
  };

  // SEO #3: Article JSON-LD con datePublished/dateModified = oggi
  // → freshness signal continuo, Google ri-visita piu' spesso
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: punStr
      ? `PUN oggi ${punStr} €/MWh: valore PUN, PSV, TTF aggiornati al ${ddmmyyyy}`
      : `PUN, PSV, TTF: prezzi energia in tempo reale al ${ddmmyyyy}`,
    description: punStr
      ? `Il valore PUN oggi è ${punStr} €/MWh. Tutti i prezzi all'ingrosso dell'energia (PUN, PSV gas, TTF) aggiornati in tempo reale dal GME.`
      : `Valori PUN, PSV gas, TTF aggiornati in tempo reale dal GME, con forecast a 180 giorni e offerte del mercato libero ARERA.`,
    image: `${SITE}/opengraph-image`,
    datePublished: observedIso,
    dateModified: todayDate.toISOString(),
    author: organization(),
    publisher: organization(),
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}/it` },
    inLanguage: "it-IT",
  };

  // SEO #4: Breadcrumb (home della sezione italiana)
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Energy Index", item: SITE },
      { "@type": "ListItem", position: 2, name: "Italia", item: `${SITE}/it` },
    ],
  };

  // SEO #5: WebPage + SpeakableSpecification — dice a Google Assistant
  // / Siri / AI Overview QUALI elementi della pagina sono adatti per
  // risposte vocali. Mark via CSS selector (.speakable-*).
  // Doc: https://schema.org/SpeakableSpecification
  // Use case: ricerca vocale "Hey Google, quanto vale il PUN oggi?" →
  // Assistant prende il contenuto degli elementi marcati .speakable-*
  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE}/it`,
    url: `${SITE}/it`,
    name: punStr
      ? `PUN oggi ${punStr} €/MWh — Energy Index`
      : "Energy Index — Osservatorio prezzi energia Italia",
    description: punStr
      ? `Il valore PUN oggi e' ${punStr} €/MWh. Tutti i prezzi all'ingrosso (PUN, PSV, TTF) aggiornati in tempo reale dal GME, con forecast e mappa offerte mercato libero.`
      : "Osservatorio dei prezzi all'ingrosso dell'energia italiana: PUN, PSV gas, TTF, forecast a 180 giorni, offerte del mercato libero.",
    inLanguage: "it-IT",
    isPartOf: {
      "@type": "WebSite",
      "@id": SITE,
      name: "Energy Index",
      url: SITE,
    },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [
        ".speakable-headline",
        ".speakable-summary",
        ".speakable-values",
      ],
    },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: `${SITE}/opengraph-image`,
    },
    datePublished: "2025-09-01",
    dateModified: todayDate.toISOString(),
    publisher: organization(),
  };

  return (
    <div className="container mx-auto py-12 sm:py-16 px-4 space-y-8 sm:space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(punDatasetJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(webPageJsonLd) }}
      />

      <header className="space-y-3">
        {/* Freshness signal visibile: <time datetime> permette a Googlebot
            di leggere la data esatta dell'aggiornamento. */}
        <p className="text-xs sm:text-sm text-muted-foreground font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5 align-middle" aria-hidden />
          Aggiornato il{" "}
          <time dateTime={observedIso} className="font-semibold">
            {ddmmyyyy}
          </time>
          {" · "}
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            Live data GME
          </span>
        </p>
        <h1 className="speakable-headline text-4xl sm:text-5xl font-bold tracking-tight">
          {punStr ? (
            <>
              PUN oggi <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">{punStr} €/MWh</span>: prezzo energia elettrica e gas in tempo reale
            </>
          ) : (
            "PUN oggi: prezzo energia elettrica e gas in tempo reale"
          )}
        </h1>
        <p className="speakable-summary text-muted-foreground text-base sm:text-lg max-w-3xl">
          Osservatorio gratuito sul <strong>valore PUN</strong> (mercato elettrico GME),{" "}
          <strong>PSV gas</strong>, <strong>TTF</strong>, Brent e CO₂. Forecast
          giornaliero a 7, 30, 90 e 180 giorni + mappa di tutte le offerte del{" "}
          <strong>mercato libero</strong> ARERA.
        </p>
        {/* Frase compatta "speakable values" pensata per AI Overview / voice:
            quando Google / Siri / Assistant leggono questa pagina per
            rispondere "quanto vale il PUN oggi?", la SpeakableSpecification
            JSON-LD punta a .speakable-values e legge solo questa frase. */}
        {punStr && psvStr ? (
          <p className="speakable-values text-base sm:text-lg max-w-3xl">
            Oggi, {ddmmyyyy}:{" "}
            <strong>PUN {punStr} €/MWh</strong>,{" "}
            <strong>PSV gas {psvStr} €/MWh</strong>
            {ttfStr ? (
              <>
                ,{" "}
                <strong>TTF gas Europa {ttfStr} €/MWh</strong>
              </>
            ) : null}
            .
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
        <PriceShowcaseCard
          href="/it/indice/pun"
          icon="zap"
          title="Energia Elettrica"
          value={pun.value}
          prevValue={pun.prevValue}
          unit={pun.unit}
          commodity="luce"
          ariaLabel="Apri analisi prezzi energia elettrica"
        />
        <PriceShowcaseCard
          href="/it/indice/psv"
          icon="flame"
          title="Gas"
          value={psv.value}
          prevValue={psv.prevValue}
          unit={psv.unit}
          commodity="gas"
          ariaLabel="Apri analisi prezzi gas"
        />
      </div>

      {/* PUN per zona — long-tail SEO: "PUN Nord", "PUN Sicilia" etc.
          Tabella semantica con headings → Google la indicizza come fonte
          dati zonale. Ogni zona linka alla pagina dettaglio + JSON-LD
          Dataset sopra spiega cos'e'. */}
      <section
        aria-labelledby="pun-zone-heading"
        className="space-y-4"
      >
        <div className="flex items-baseline justify-between flex-wrap gap-2 border-l-4 border-primary pl-3">
          <h2
            id="pun-zone-heading"
            className="text-xl sm:text-2xl font-semibold tracking-tight"
          >
            PUN per zona oggi
          </h2>
          <Link
            href="/it/indice/pun"
            className="text-sm text-primary hover:underline"
          >
            Dettaglio PUN →
          </Link>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Il PUN è la media ponderata delle 6 zone GME. Clicca su una zona
          per la serie temporale e il forecast a 90 giorni.
        </p>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Valori PUN per zona italiana aggiornati al {ddmmyyyy}
            </caption>
            <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th scope="col" className="text-left px-4 py-2.5 font-semibold">
                  Zona GME
                </th>
                <th scope="col" className="text-right px-4 py-2.5 font-semibold">
                  Valore (€/MWh)
                </th>
                <th scope="col" className="text-right px-4 py-2.5 font-semibold hidden sm:table-cell">
                  Δ vs prec.
                </th>
                <th scope="col" className="text-right px-4 py-2.5 font-semibold w-16">
                  Vai
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {zones.map((z) => {
                const valueStr = z.value !== null ? formatValue(z.value) : "—";
                const delta =
                  z.value !== null && z.prevValue !== null && z.prevValue !== 0
                    ? ((z.value - z.prevValue) / z.prevValue) * 100
                    : null;
                const deltaStr =
                  delta !== null
                    ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`
                    : "—";
                const deltaClass =
                  delta === null
                    ? "text-muted-foreground"
                    : delta > 1
                      ? "text-rose-600 dark:text-rose-400"
                      : delta < -1
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground";
                return (
                  <tr key={z.code} className="hover:bg-muted/30 transition-colors">
                    <th
                      scope="row"
                      className="text-left px-4 py-2.5 font-medium"
                    >
                      <Link
                        href={`/it/indice/pun?zone=${z.code}`}
                        className="hover:text-primary"
                        aria-label={`PUN zona ${z.label} dettaglio`}
                      >
                        PUN {z.label}
                      </Link>
                    </th>
                    <td className="text-right px-4 py-2.5 tabular-nums font-semibold">
                      {valueStr}
                    </td>
                    <td
                      className={`text-right px-4 py-2.5 tabular-nums hidden sm:table-cell ${deltaClass}`}
                    >
                      {deltaStr}
                    </td>
                    <td className="text-right px-4 py-2.5">
                      <Link
                        href={`/it/indice/pun?zone=${z.code}`}
                        className="text-primary hover:underline text-xs"
                        aria-label={`Apri PUN zona ${z.label}`}
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground italic max-w-3xl">
          Fonte: GME (Gestore dei Mercati Energetici) · Aggiornato giornalmente
          dopo la chiusura della sessione MGP.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight border-l-4 border-primary pl-3">
          Driver di mercato
        </h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <DriverCard
            href="/it/indice/ttf"
            icon={FlameIcon}
            title="TTF Gas Europa"
            subtitle="Benchmark front-month"
            value={ttf.value}
            prevValue={ttf.prevValue}
            unit="€/MWh"
          />
          <DriverCard
            href="/it/indice/brent"
            icon={Droplets}
            title="Brent"
            subtitle="Petrolio greggio"
            value={brent.value}
            prevValue={brent.prevValue}
            unit="$/bbl"
          />
          <DriverCard
            href="/it/indice/co2"
            icon={Leaf}
            title="CO2 EUA"
            subtitle="Quota emissione EU ETS"
            value={co2.value}
            prevValue={co2.prevValue}
            unit="€/tCO2"
          />
          <DriverCard
            href="/it/indice/temperatura"
            icon={Thermometer}
            title="Temperatura Italia"
            subtitle="Anomalia stagionale"
            value={tempAnom.value}
            unit="°C"
            anomaly={tempAnom.baseline_years >= 3 ? tempAnom.anomaly : null}
            baselineLabel="vs media 5 anni"
          />
        </div>
      </section>

      {/* MARKET BANNER (consumer-end: confronto offerte mercato libero) */}
      <MarketBanner
        luceVariabileMedian={market.luceVariabileMedian}
        totalOffers={market.totalOffers}
      />

      {/* MEGA-CARD MARKET MAP — visualizza ~500 offerte ARERA + brand commerciali
          live in una mappa interattiva stile borsa. Tema dark/Matrix per richiamare
          l'estetica del ticker. */}
      <Link
        href="/it/mercato-libero/ticker"
        className="group relative block overflow-hidden rounded-3xl bg-black ring-1 ring-emerald-400/30 shadow-2xl shadow-emerald-900/40 transition-all hover:shadow-emerald-900/60 hover:-translate-y-1"
      >
        {/* Decorative grid (CSS background) — richiama il look ticker */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(16, 185, 129, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.15) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -bottom-32 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl"
        />

        <div className="relative p-8 sm:p-12 lg:p-16">
          {/* Top label */}
          <div className="flex items-center gap-2 mb-6">
            <span
              className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse"
              aria-hidden
            />
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-300">
              Live · ~500 offerte attive · ARERA open data
            </span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-5">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.05]">
                Market Map
                <br />
                <span className="text-emerald-300 font-mono">offerte luce e gas</span>
              </h2>
              <p className="text-base sm:text-lg text-emerald-100/80 max-w-2xl">
                Visualizza in una mappa interattiva tutte le offerte commerciali
                del mercato libero italiano: filtra per fornitore, regione, prezzo,
                tipologia. Aggiornata giornalmente dal Portale Offerte ARERA e
                scraping diretto dei top 5 brand.
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-emerald-100/70 max-w-2xl">
                <li className="flex items-baseline gap-2">
                  <span className="text-emerald-400 mt-0.5" aria-hidden>
                    ▸
                  </span>
                  <span>1.500+ offerte PLACET ARERA</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="text-emerald-400 mt-0.5" aria-hidden>
                    ▸
                  </span>
                  <span>5 brand commerciali (Enel/Eni/Edison/Acea/Engie)</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="text-emerald-400 mt-0.5" aria-hidden>
                    ▸
                  </span>
                  <span>Filtri per regione + cluster consumo</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="text-emerald-400 mt-0.5" aria-hidden>
                    ▸
                  </span>
                  <span>Confronto prezzo €/MWh real-time</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col items-stretch lg:items-end gap-3 shrink-0">
              <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-emerald-400 px-8 py-5 text-base lg:text-lg font-bold text-emerald-950 shadow-xl shadow-emerald-500/40 transition-all group-hover:scale-[1.03] group-hover:shadow-emerald-500/60">
                <span aria-hidden className="text-xl font-mono">
                  ⊞
                </span>
                Apri Market Map
                <span aria-hidden className="ml-1 transition-transform group-hover:translate-x-1">
                  →
                </span>
              </span>
              <p className="text-xs text-emerald-300/60 text-center lg:text-right font-mono">
                Vista borsa · dark theme · niente login
              </p>
            </div>
          </div>
        </div>
      </Link>

      {/* MEGA CTA verso EIDX Pro — audience B2B (fornitori/mandanti/broker)
          posizionata SOTTO il banner consumer, cosi' chi cerca offerte trova
          subito il banner mercato libero; chi e' azienda scrolla un po'
          piu' giu' e trova il CTA Pro. */}
      <Link
        href="/it/pro"
        className="group relative block overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a3d2e] via-[#0f5239] to-[#0a3d2e] p-8 sm:p-12 shadow-2xl shadow-emerald-900/20 transition-all hover:shadow-emerald-900/40 hover:-translate-y-1 ring-1 ring-emerald-400/10"
      >
        {/* Decorative glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -bottom-20 h-60 w-60 rounded-full bg-amber-400/10 blur-3xl"
        />

        <div className="relative flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
          <div className="flex-1 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" aria-hidden />
              Per fornitori, mandanti, broker
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Sei un&apos;azienda del settore energy?{" "}
              <span className="text-emerald-300">EIDX Pro</span> è il tuo tool.
            </h2>
            <p className="text-base md:text-lg text-emerald-50/90 max-w-xl">
              Lo stack analytics per fornitori energy, broker e PMI energivore. 4 tool per
              simulare margini, modellare scenari di mercato, generare report brandizzati e
              trovare l&apos;offerta migliore per ogni cliente.
            </p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-emerald-50/80">
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-300 mt-0.5" aria-hidden>✓</span>
                <span>Margin Simulator (P&amp;L cliente)</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-300 mt-0.5" aria-hidden>✓</span>
                <span>Forecast &amp; Scenari what-if</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-300 mt-0.5" aria-hidden>✓</span>
                <span>Report PDF brandizzato</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-300 mt-0.5" aria-hidden>✓</span>
                <span>Customer Simulator (best offer)</span>
              </li>
            </ul>
          </div>

          <div className="flex-shrink-0 flex flex-col items-stretch lg:items-end gap-3">
            <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-emerald-400 px-8 py-5 text-base md:text-lg font-bold text-emerald-950 shadow-xl shadow-emerald-500/30 transition-all group-hover:scale-[1.03] group-hover:shadow-emerald-500/50">
              <span aria-hidden className="text-xl">→</span>
              Scopri EIDX Pro
            </span>
            <p className="text-xs text-emerald-200/70 text-center lg:text-right">
              Demo gratuite · niente registrazione · lancio Q3 2026
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}
