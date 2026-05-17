import type { Metadata } from "next";
import Link from "next/link";
import { LeadCaptureForm } from "@/components/pro/LeadCaptureForm";
import { PricingSection, ANNUAL_DISCOUNT_PCT, type PricingTierData } from "@/components/pro/PricingSection";
import { breadcrumbList, jsonLdString, organization } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "EIDX Pro — analytics professionali per il mercato energy",
  description:
    "Margin simulator, forecast a 24 mesi con scenari, report PDF brandizzati. Lo stack analytics per fornitori, broker e PMI energivore. Lancio Q3 2026.",
  openGraph: {
    title: "EIDX Pro — analytics professionali per il mercato energy",
    description:
      "Lo stack analytics per fornitori, broker e PMI energivore. Lancio Q3 2026.",
    type: "website",
    locale: "it_IT",
    url: "/it/pro",
  },
  twitter: { card: "summary_large_image" },
};

const PUBLISHED = "2026-05-16";

interface ModuleCard {
  number: string;
  title: string;
  description: string;
  features: string[];
  status: "in arrivo" | "beta" | "live";
  tier: "Pro" | "Enterprise" | "Pro / Enterprise";
  tryDemoHref?: string;
}

const MODULES: ModuleCard[] = [
  {
    number: "01",
    title: "Margin Simulator",
    description:
      "Simula in tempo reale il margine di vendita su offerte fisse/variabili PUN/PSV. Carica il tuo costo di rete + accise, imposta lo spread, vedi P&L e break-even point.",
    features: [
      "Curve PUN/PSV forward 24 mesi con scenari (base/peggiore/migliore)",
      "Margin scorer su portafoglio offerte (CSV upload)",
      "Stress test su shock geopolitici e meteorologici",
      "Export PDF per back-office",
    ],
    status: "in arrivo",
    tier: "Pro / Enterprise",
    tryDemoHref: "/it/pro/simulator",
  },
  {
    number: "02",
    title: "Forecast & Scenario",
    description:
      "Forecast PUN/PSV/TTF a 24 mesi (vs 180 giorni del tier free) con scenari what-if interattivi. Modifica una variabile (es. temperatura, prezzo gas) e vedi l'impatto sul forecast in tempo reale.",
    features: [
      "Orizzonti fino a 24 mesi",
      "Scenari custom: cambia gli input, ricalcola la previsione",
      "Confidence band a 95%/99% calibrata",
      "API access programmatico (REST + webhook)",
    ],
    status: "in arrivo",
    tier: "Pro / Enterprise",
  },
  {
    number: "03",
    title: "Report Builder",
    description:
      "Genera report PDF brandizzati con i tuoi colori e logo: monthly outlook, ad-hoc su singolo cliente, pitch deck per direzione. Tutti i dati di Energy Index pre-confezionati in tabelle e grafici professionali.",
    features: [
      "Template white-label (logo + palette cliente)",
      "Schedulazione automatica (monthly/weekly)",
      "Distribuzione lista email integrata",
      "Custom research on-demand (Enterprise)",
    ],
    status: "in arrivo",
    tier: "Enterprise",
  },
  {
    number: "04",
    title: "Customer Simulator",
    description:
      "Trova in tempo reale l'offerta migliore per ogni profilo cliente del mercato libero. Confronta tutte le offerte considerando prezzo unitario + costo commercializzazione fisso. Real-time mentre sposti il consumo.",
    features: [
      "Slider consumo luce + gas, ricalcolo istantaneo",
      "Best offer + top alternative ranked",
      "Variabile: forecast PUN/PSV + spread",
      "Fisso: prezzo bloccato + commercializzazione",
    ],
    status: "in arrivo",
    tier: "Pro / Enterprise",
    tryDemoHref: "/it/pro/customer-simulator",
  },
];

const TIERS: PricingTierData[] = [
  {
    name: "Free",
    monthlyPriceEur: 0,
    isFree: true,
    description: "Forecast pubblico Energy Index. Per chi vuole monitorare il mercato.",
    features: [
      "Forecast PUN/PSV/TTF 7/30/90/180 giorni",
      "Track record verificabile",
      "Metodologia pubblica",
      "Storico illimitato",
    ],
    ctaLabel: "Esplora gratis",
    ctaHref: "/it/forecast",
  },
  {
    name: "Pro",
    monthlyPriceEur: 499,
    description: "Per fornitori energy, broker e consulenti che vendono offerte.",
    features: [
      "Tutto del piano Free",
      "Margin Simulator (Modulo 1)",
      "Forecast 12 mesi con scenari (Modulo 2)",
      "API access programmatico",
      "Alert email su soglie prezzo",
      "Support 48h",
    ],
    ctaLabel: "Avvisami al lancio",
    ctaHref: "#early-access",
    highlight: true,
  },
  {
    name: "Enterprise",
    monthlyPriceEur: 3500,
    description: "Per utility, top broker, PMI energivore. White-label e custom.",
    features: [
      "Tutto del piano Pro",
      "Forecast 24 mesi",
      "Report Builder white-label (Modulo 3)",
      "Custom research on-demand",
      "Account dedicato",
      "SLA 24h + onboarding personalizzato",
    ],
    ctaLabel: "Contatto commerciale",
    ctaHref: "mailto:commerciale@deagroup.biz?subject=EIDX%20Pro%20Enterprise%20-%20Richiesta%20demo",
  },
];

export default function ProLandingPage() {
  return (
    <div className="container mx-auto px-4 py-10 space-y-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString({
            "@context": "https://schema.org",
            "@type": "Service",
            serviceType: "Energy Market Analytics SaaS",
            provider: organization(),
            url: "https://energyindex.it/it/pro",
            description:
              "Margin simulator, forecast 24 mesi con scenari, report PDF brandizzati per fornitori energy, broker e PMI energivore. Lancio Q3 2026.",
            availableChannel: {
              "@type": "ServiceChannel",
              serviceUrl: "https://energyindex.it/it/pro",
            },
            offers: TIERS.filter((t) => !t.isFree).flatMap((t) => {
              const annualTotal = Math.round(t.monthlyPriceEur * 12 * (1 - ANNUAL_DISCOUNT_PCT));
              return [
                {
                  "@type": "Offer",
                  name: `EIDX Pro ${t.name} — mensile`,
                  price: String(t.monthlyPriceEur),
                  priceCurrency: "EUR",
                  priceSpecification: {
                    "@type": "UnitPriceSpecification",
                    price: String(t.monthlyPriceEur),
                    priceCurrency: "EUR",
                    unitText: "MONTH",
                  },
                  availability: "https://schema.org/PreOrder",
                  url: "https://energyindex.it/it/pro#early-access",
                },
                {
                  "@type": "Offer",
                  name: `EIDX Pro ${t.name} — annuale (sconto 15%)`,
                  price: String(annualTotal),
                  priceCurrency: "EUR",
                  priceSpecification: {
                    "@type": "UnitPriceSpecification",
                    price: String(annualTotal),
                    priceCurrency: "EUR",
                    unitText: "YEAR",
                  },
                  availability: "https://schema.org/PreOrder",
                  url: "https://energyindex.it/it/pro#early-access",
                },
              ];
            }),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            breadcrumbList([
              { name: "Home", url: "https://energyindex.it/it" },
              { name: "EIDX Pro", url: "https://energyindex.it/it/pro" },
            ]),
          ),
        }}
      />

      {/* HERO */}
      <header className="space-y-6 max-w-3xl py-8 sm:py-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" aria-hidden />
          In arrivo Q3 2026
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          EIDX Pro — analytics professionali per il mercato energy
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground">
          Margin simulator, forecast a 24 mesi con scenari, report PDF brandizzati. Lo stack analytics
          per fornitori, broker e PMI energivore — costruito sui dati e sui modelli di Energy Index.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href="#early-access"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.02]"
          >
            Avvisami al lancio
          </a>
          <Link
            href="/it/forecast"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-accent transition-colors"
          >
            Prova il forecast gratis →
          </Link>
        </div>
      </header>

      {/* MEGA CTA — DEMO SIMULATOR */}
      <Link
        href="/it/pro/simulator"
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
              Live demo · gratis · zero registrazione
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Prova il Margin Simulator <span className="text-emerald-300">adesso</span>
            </h2>
            <p className="text-base md:text-lg text-emerald-50/90 max-w-xl">
              Sposta gli slider e vedi margine, LTV e posizionamento competitor ricalcolarsi
              in tempo reale. Confronta contratto variabile e fisso. Stressa 4 scenari di mercato.
              60 secondi di tour guidato dentro.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-emerald-50/80">
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-300 mt-0.5" aria-hidden>✓</span>
                <span>Forecast PUN 12 mesi con banda 5–95%</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-300 mt-0.5" aria-hidden>✓</span>
                <span>Benchmark su ~500 offerte ARERA live</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-300 mt-0.5" aria-hidden>✓</span>
                <span>Variabile passthrough vs Fisso lock-in</span>
              </li>
              <li className="flex items-baseline gap-2">
                <span className="text-emerald-300 mt-0.5" aria-hidden>✓</span>
                <span>What-if custom: volume, costo, churn</span>
              </li>
            </ul>
          </div>

          <div className="flex-shrink-0 flex flex-col items-stretch lg:items-end gap-3">
            <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-emerald-400 px-8 py-5 text-base md:text-lg font-bold text-emerald-950 shadow-xl shadow-emerald-500/30 transition-all group-hover:scale-[1.03] group-hover:shadow-emerald-500/50">
              <span aria-hidden className="text-xl">▶</span>
              Apri il simulatore
              <span aria-hidden className="ml-1">→</span>
            </span>
            <p className="text-xs text-emerald-200/70 text-center lg:text-right">
              Funziona da browser · niente download · niente login
            </p>
          </div>
        </div>
      </Link>

      {/* MODULI */}
      <section className="space-y-8">
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Quattro moduli, un singolo workflow</h2>
          <p className="text-muted-foreground">
            Pensati per la giornata tipo di chi vende, copre o consuma energia in volumi significativi.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {MODULES.map((m) => (
            <article
              key={m.number}
              className="rounded-2xl border bg-card p-6 sm:p-8 space-y-4 transition-all hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-primary/70">{m.number}</span>
                <span className="text-xs uppercase tracking-widest rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-1">
                  {m.status}
                </span>
              </div>
              <h3 className="text-xl font-bold">{m.title}</h3>
              <p className="text-sm text-muted-foreground">{m.description}</p>
              <ul className="space-y-1.5 text-sm pt-2 border-t">
                {m.features.map((f) => (
                  <li key={f} className="flex items-baseline gap-2">
                    <span className="text-primary mt-0.5" aria-hidden>
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Disponibile su: <span className="font-semibold">{m.tier}</span>
              </p>
              {m.tryDemoHref && (
                <Link
                  href={m.tryDemoHref}
                  className="inline-flex items-center justify-center w-full mt-2 px-4 py-2 rounded-md bg-[#0a3d2e] text-white text-sm font-semibold hover:bg-[#0a3d2e]/90 transition-colors"
                >
                  Prova la demo &rarr;
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <PricingSection tiers={TIERS} />

      {/* PROOF */}
      <section className="rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-card p-8 sm:p-12 space-y-6">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
          Costruito sopra Energy Index.
        </h2>
        <p className="text-muted-foreground max-w-2xl">
          Tutti i forecast EIDX Pro usano lo <strong>stesso modello</strong> esposto pubblicamente
          su{" "}
          <Link href="/it/forecast" className="underline font-medium">
            energyindex.it/forecast
          </Link>
          . Track record verificabile,{" "}
          <Link href="/it/forecast/metodologia" className="underline font-medium">
            metodologia pubblica
          </Link>
          , niente black box. La differenza non e&apos; nei dati base, e&apos; negli strumenti che ci
          costruiamo sopra: simulazione margini, scenari custom, report on-demand.
        </p>
        <div className="grid sm:grid-cols-3 gap-6 pt-4 border-t">
          <div>
            <div className="text-3xl font-bold text-primary tabular-nums">6.92%</div>
            <p className="text-xs text-muted-foreground">MAPE PUN forecast 180g (verificato)</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary tabular-nums">~2.920</div>
            <p className="text-xs text-muted-foreground">Forecast retrospettivi verificabili</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary tabular-nums">8+ anni</div>
            <p className="text-xs text-muted-foreground">Storico PUN/PSV/TTF in DB</p>
          </div>
        </div>
      </section>

      {/* EARLY ACCESS FORM */}
      <section id="early-access" className="rounded-2xl border border-primary/30 bg-primary/5 p-8 sm:p-12 space-y-6 max-w-2xl mx-auto scroll-mt-20">
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Pre-registrazione lancio</h2>
          <p className="text-muted-foreground">
            Ti contatteremo prima del lancio ufficiale (Q3 2026) con accesso prioritario e pricing early-bird (sconto 30% sul primo anno).
          </p>
        </div>
        <LeadCaptureForm />
      </section>

      <footer className="text-center text-xs text-muted-foreground pt-8 border-t">
        Documento pubblicato il {PUBLISHED}. Piano e tempi indicativi, soggetti a aggiornamento.
        EIDX Pro e&apos; un sotto-brand di Energy Index, gestito da DEA Group.
      </footer>
    </div>
  );
}
