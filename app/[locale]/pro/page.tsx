import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, Users, LineChart, FileText, Activity, Shield, FlaskConical, BellRing } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  icon: LucideIcon;
  accentClass: string;  // gradient sfumatura + glow per la card
  secondaryLink?: { href: string; label: string };
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
    icon: TrendingUp,
    accentClass: "from-emerald-50/60 to-card",
  },
  {
    number: "02",
    title: "Customer Simulator",
    description:
      "Trova in tempo reale l'offerta migliore per ogni profilo cliente del mercato libero. Confronta tutte le offerte considerando prezzo unitario + costo commercializzazione fisso. Real-time mentre sposti il consumo. + 5 cluster preset con PDF stampabile.",
    features: [
      "Slider consumo luce + gas, ricalcolo istantaneo",
      "Best offer + top alternative ranked",
      "Variabile: forecast PUN/PSV + spread",
      "Fisso: prezzo bloccato + commercializzazione",
    ],
    status: "in arrivo",
    tier: "Pro / Enterprise",
    tryDemoHref: "/it/pro/customer-simulator",
    icon: Users,
    accentClass: "from-sky-50/60 to-card",
  },
  {
    number: "03",
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
    tryDemoHref: "/it/pro/forecast-scenari",
    icon: LineChart,
    accentClass: "from-amber-50/60 to-card",
    secondaryLink: {
      href: "/it/forecast",
      label: "Vuoi solo i dati pubblici? Forecast gratis (PUN/PSV/TTF 7-180g)",
    },
  },
  {
    number: "04",
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
    tryDemoHref: "/it/pro/report-builder",
    icon: FileText,
    accentClass: "from-rose-50/60 to-card",
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
    name: "Trading",
    monthlyPriceEur: 999,
    description: "Per trader desk, risk manager, asset manager italiani.",
    features: [
      "Tutto del piano Pro",
      "Trading Vitals (Spark Spread, cross spreads, ATR)",
      "Correlation matrix rolling 30g",
      "Risk & Hedging (in arrivo Wave 2)",
      "Backtest engine (Wave 3)",
      "API access dedicato",
    ],
    ctaLabel: "Avvisami al lancio",
    ctaHref: "#early-access",
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
          <a
            href="#moduli"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-accent transition-colors"
          >
            Vedi i 4 moduli
          </a>
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

      {/* SEZIONE TRADER */}
      <section className="space-y-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
            Per trader e risk manager
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">EIDX Trading Desk</h2>
          <p className="text-muted-foreground">
            Strumenti purpose-built per chi tradera&apos; PUN/PSV ogni giorno: spark spread italiano, volatility, correlation matrix, risk metrics. Niente Bloomberg da 22k€/anno.
          </p>
        </div>

        {/* Featured card live + 3 placeholder coming soon */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* CARD 1 LIVE — Trading Vitals */}
          <Link
            href="/it/pro/trading/vitals"
            className="group relative flex flex-col rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50/60 to-card p-7 sm:p-9 transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500/60 hover:shadow-2xl hover:shadow-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            aria-label="Prova la demo: Trading Vitals"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 shadow-sm transition-all duration-300 group-hover:bg-emerald-600 group-hover:text-white group-hover:scale-110">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700/60 tracking-wider">WAVE 1</span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.15em] rounded-full bg-emerald-500/15 text-emerald-700 px-2.5 py-1 font-bold">
                Live demo
              </span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight mb-2">Trading Vitals</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Dashboard live con i 4 indicatori critici del trader desk italiano: Spark Spread CCGT, cross spreads gas-power, ATR volatility e correlation matrix tra PUN/PSV/TTF/Brent/CO2.
            </p>
            <ul className="space-y-1.5 text-sm pt-4 border-t border-border/60 mb-4">
              <li className="flex items-baseline gap-2"><span className="text-emerald-700 font-bold">✓</span> Spark spread con percentili 1Y</li>
              <li className="flex items-baseline gap-2"><span className="text-emerald-700 font-bold">✓</span> Cross spreads PUN-PSV / PSV-TTF</li>
              <li className="flex items-baseline gap-2"><span className="text-emerald-700 font-bold">✓</span> ATR 14g per asset</li>
              <li className="flex items-baseline gap-2"><span className="text-emerald-700 font-bold">✓</span> Correlation heatmap rolling 30g</li>
            </ul>
            <div className="mt-auto pt-4 border-t border-border/60 space-y-3">
              <p className="text-xs text-muted-foreground">Disponibile su: <span className="font-semibold text-foreground">Trading / Enterprise</span></p>
              <span className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-sm transition-all duration-300 group-hover:bg-emerald-500 group-hover:shadow-lg group-hover:shadow-emerald-500/30">
                Prova la demo
              </span>
            </div>
          </Link>

          {/* CARD 2 LIVE — Risk & Hedging (Wave 2) */}
          <Link
            href="/it/pro/trading/risk"
            className="group relative flex flex-col rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-50/60 to-card p-7 sm:p-9 transition-all duration-300 hover:-translate-y-1.5 hover:border-sky-500/60 hover:shadow-2xl hover:shadow-sky-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            aria-label="Prova la demo: Risk & Hedging"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 shadow-sm transition-all duration-300 group-hover:bg-sky-600 group-hover:text-white group-hover:scale-110">
                  <Shield className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold text-sky-700/60 tracking-wider">WAVE 2</span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.15em] rounded-full bg-emerald-500/15 text-emerald-700 px-2.5 py-1 font-bold">
                Live demo
              </span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight mb-2">Risk &amp; Hedging</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Mark-to-market portafoglio open positions, VaR 1g/10g parametrico, hedge ratio calculator, stress scenari sul P&amp;L.
            </p>
            <ul className="space-y-1.5 text-sm pt-4 border-t border-border/60 mb-4">
              <li className="flex items-baseline gap-2"><span className="text-sky-700 font-bold">✓</span> Position tracker (input manuale o CSV)</li>
              <li className="flex items-baseline gap-2"><span className="text-sky-700 font-bold">✓</span> Mark-to-market vs spot / forecast</li>
              <li className="flex items-baseline gap-2"><span className="text-sky-700 font-bold">✓</span> VaR 1g / 10g a 95% e 99%</li>
              <li className="flex items-baseline gap-2"><span className="text-sky-700 font-bold">✓</span> Stress: TTF+30%, recessione, freddo</li>
            </ul>
            <div className="mt-auto pt-4 border-t border-border/60 space-y-3">
              <p className="text-xs text-muted-foreground">Disponibile su: <span className="font-semibold text-foreground">Trading / Enterprise</span></p>
              <span className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold shadow-sm transition-all duration-300 group-hover:bg-sky-500 group-hover:shadow-lg group-hover:shadow-sky-500/30">
                Prova la demo
              </span>
            </div>
          </Link>

          {/* CARD 3 COMING SOON — Backtest engine (Wave 3) */}
          <div className="relative flex flex-col rounded-3xl border border-border bg-gradient-to-br from-amber-50/40 to-card p-7 sm:p-9 opacity-90">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 shadow-sm">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold text-amber-700/60 tracking-wider">WAVE 3</span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.15em] rounded-full bg-amber-500/15 text-amber-700 px-2.5 py-1 font-bold">In arrivo 2027</span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight mb-2">Backtest engine</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Editor di strategie con DSL semplice. Run su 5 anni di storico PUN/PSV. Output: P&amp;L cumulato, max drawdown, Sharpe, hit ratio.
            </p>
            <ul className="space-y-1.5 text-sm pt-4 border-t border-border/60">
              <li className="flex items-baseline gap-2"><span className="text-amber-700 font-bold">✓</span> Editor DSL (SE/ALLORA su indicatori)</li>
              <li className="flex items-baseline gap-2"><span className="text-amber-700 font-bold">✓</span> Backtest su 5y di dati daily</li>
              <li className="flex items-baseline gap-2"><span className="text-amber-700 font-bold">✓</span> Metriche standard quant (Sharpe, DD)</li>
              <li className="flex items-baseline gap-2"><span className="text-amber-700 font-bold">✓</span> Salvataggio strategie + share link</li>
            </ul>
          </div>

          {/* CARD 4 COMING SOON — Alert & API (Wave 3) */}
          <div className="relative flex flex-col rounded-3xl border border-border bg-gradient-to-br from-rose-50/40 to-card p-7 sm:p-9 opacity-90">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-700 shadow-sm">
                  <BellRing className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono font-bold text-rose-700/60 tracking-wider">WAVE 3</span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.15em] rounded-full bg-amber-500/15 text-amber-700 px-2.5 py-1 font-bold">In arrivo 2027</span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight mb-2">Alert &amp; API</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Trigger su soglie prezzo / spread / percentile + REST API per Excel proprietary models.
            </p>
            <ul className="space-y-1.5 text-sm pt-4 border-t border-border/60">
              <li className="flex items-baseline gap-2"><span className="text-rose-700 font-bold">✓</span> Alert email + webhook per soglie</li>
              <li className="flex items-baseline gap-2"><span className="text-rose-700 font-bold">✓</span> REST API endpoint per integration</li>
              <li className="flex items-baseline gap-2"><span className="text-rose-700 font-bold">✓</span> Plugin Excel (XLOOKUP function)</li>
              <li className="flex items-baseline gap-2"><span className="text-rose-700 font-bold">✓</span> Track record signals storici</li>
            </ul>
          </div>
        </div>
      </section>

      {/* MODULI */}
      <section id="moduli" className="space-y-8 scroll-mt-20">
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Tool generalisti — funzionano per fornitori, broker e PMI</h2>
          <p className="text-muted-foreground">
            Pensati per la giornata tipo di chi vende, copre o consuma energia in volumi significativi.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {MODULES.map((m) => {
            const Icon = m.icon;
            const href = m.tryDemoHref ?? "#";
            return (
              // Wrapper esterno per gestire un secondaryLink come Link "fratello"
              // (non nested) sotto la card cliccabile principale.
              <div
                key={m.number}
                className={`group relative flex flex-col rounded-3xl border border-border bg-gradient-to-br ${m.accentClass} overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/60 hover:shadow-2xl hover:shadow-primary/15`}
              >
                {/* Decorative corner glow on hover */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/0 blur-2xl transition-colors duration-500 group-hover:bg-primary/15"
                />

                {/* Main clickable region -> demo */}
                <Link
                  href={href}
                  aria-label={`Prova la demo: ${m.title}`}
                  className="flex flex-col flex-1 p-7 sm:p-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                >
                  {/* Header: icon + status */}
                  <div className="relative flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 group-hover:rotate-3">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <span className="text-xs font-mono font-bold text-primary/60 tracking-wider">
                        {m.number}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.15em] rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2.5 py-1 font-bold">
                      {m.status}
                    </span>
                  </div>

                  {/* Title + description */}
                  <h3 className="text-2xl font-bold tracking-tight mb-2">{m.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {m.description}
                  </p>

                  {/* Features */}
                  <ul className="space-y-1.5 text-sm pt-4 border-t border-border/60 mb-4">
                    {m.features.map((f) => (
                      <li key={f} className="flex items-baseline gap-2">
                        <span className="text-primary mt-0.5 font-bold" aria-hidden>
                          ✓
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Footer: tier + CTA button */}
                  <div className="mt-auto pt-4 border-t border-border/60 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Disponibile su: <span className="font-semibold text-foreground">{m.tier}</span>
                    </p>
                    <span className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-[#0a3d2e] text-white text-sm font-semibold shadow-sm transition-all duration-300 group-hover:bg-emerald-500 group-hover:shadow-lg group-hover:shadow-emerald-500/30">
                      Prova la demo
                    </span>
                  </div>
                </Link>

                {/* Secondary link strip (per Modulo Forecast & Scenari):
                    Link separato, non nested. Click su questa fascia atterra
                    sul forecast pubblico free invece che sulla demo Pro. */}
                {m.secondaryLink && (
                  <Link
                    href={m.secondaryLink.href}
                    className="group/sec relative block border-t border-border/60 bg-card/40 px-7 sm:px-9 py-3 text-xs text-muted-foreground hover:bg-emerald-50/60 dark:hover:bg-emerald-900/10 hover:text-foreground transition-colors"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{m.secondaryLink.label}</span>
                      <span aria-hidden className="text-emerald-600 font-bold opacity-70 group-hover/sec:opacity-100 group-hover/sec:translate-x-0.5 transition-all">
                        →
                      </span>
                    </span>
                  </Link>
                )}
              </div>
            );
          })}
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
