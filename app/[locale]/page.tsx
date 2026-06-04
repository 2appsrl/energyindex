import type { Metadata } from "next";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { PriceShowcaseCard } from "@/components/home/PriceShowcaseCard";
import { MarketBanner } from "@/components/home/MarketBanner";
import { DriverCard } from "@/components/home/DriverCard";
import { Droplets, Flame as FlameIcon, Leaf, Thermometer } from "lucide-react";
import { jsonLdString } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  // SEO target: "PUN energia", "PUN oggi", "prezzo PUN", "PUN GME"
  title: "PUN oggi — Prezzo PUN energia elettrica in tempo reale | Energy Index",
  description:
    "PUN oggi: prezzo energia elettrica all'ingrosso in tempo reale (GME). Forecast PUN/PSV/TTF a 7/30/90/180 giorni con track record verificabile. Offerte mercato libero ARERA. Gratis.",
  keywords: [
    "PUN",
    "PUN oggi",
    "prezzo PUN",
    "PUN energia",
    "PUN GME",
    "prezzo energia elettrica",
    "PSV gas",
    "TTF",
    "mercato libero energia",
    "forecast PUN",
    "energy index",
  ],
  alternates: {
    canonical: "https://energyindex.it/it",
  },
  openGraph: {
    title: "PUN oggi — Prezzo energia elettrica in tempo reale | Energy Index",
    description:
      "PUN, PSV, TTF in tempo reale dal GME + forecast a 180 giorni + offerte mercato libero ARERA. Gratis, no registrazione.",
    type: "website",
    locale: "it_IT",
    url: "/it",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "PUN oggi — Prezzo energia elettrica in tempo reale",
    description: "PUN GME + forecast + offerte ARERA, gratis su energyindex.it",
    images: ["/opengraph-image"],
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

export default async function HomeIt() {
  const supabase = await createServerClient();
  const [pun, psv, market, brent, co2, tempAnom, ttf] = await Promise.all([
    getLatestPair(supabase, "pun"),
    getLatestPair(supabase, "psv"),
    getMarketBannerData(supabase),
    getDriverLatest(supabase, "brent"),
    getDriverLatest(supabase, "co2"),
    getTemperatureAnomaly(supabase),
    getDriverLatest(supabase, "ttf"),
  ]);

  // SEO: FAQ JSON-LD per ranking "PUN energia" (rich snippets su Google)
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
        name: "Qual è il PUN oggi?",
        acceptedAnswer: {
          "@type": "Answer",
          text: pun.value
            ? `Il PUN oggi è ${pun.value.toFixed(2)} ${pun.unit}. Aggiornato in tempo reale su energyindex.it dalle pubblicazioni ufficiali del GME.`
            : "Il valore PUN più recente è visualizzato in tempo reale sul nostro sito, aggiornato dalle pubblicazioni ufficiali del GME.",
        },
      },
      {
        "@type": "Question",
        name: "Come si calcola il PUN?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Il PUN è la media ponderata dei prezzi zonali (Nord, Centro-Nord, Centro-Sud, Sud, Calabria, Sicilia, Sardegna) sui volumi di acquisto effettivi nel mercato del giorno prima. Viene pubblicato ogni giorno dal GME dopo la chiusura della sessione MGP.",
        },
      },
      {
        "@type": "Question",
        name: "Cosa significa PSV nel mercato gas?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Il PSV (Punto di Scambio Virtuale) è il prezzo all'ingrosso del gas naturale in Italia, riferimento per le offerte gas variabili del mercato libero. È espresso in €/MWh o €/Smc.",
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
    ],
  };

  return (
    <div className="container mx-auto py-12 sm:py-16 px-4 space-y-8 sm:space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
      />

      <header className="space-y-3">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          PUN oggi: prezzo energia elettrica e gas in tempo reale
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-3xl">
          Osservatorio gratuito su <strong>PUN</strong> (mercato elettrico GME),{" "}
          <strong>PSV</strong> (gas naturale), <strong>TTF</strong>, Brent e CO₂. Forecast
          giornaliero a 7, 30, 90 e 180 giorni + mappa di tutte le offerte del mercato
          libero ARERA.
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
