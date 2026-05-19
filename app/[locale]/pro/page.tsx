import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp,
  Users,
  LineChart,
  FileText,
  Activity,
  Shield,
  FlaskConical,
  BellRing,
  Lock,
  AlertTriangle,
  Heart,
  Sliders,
  ClipboardSignature,
  FileCheck2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LeadCaptureForm } from "@/components/pro/LeadCaptureForm";
import { MegaCTACarousel } from "@/components/pro/MegaCTACarousel";
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

const MARKETING_MODULES: ModuleCard[] = [
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
  {
    number: "05",
    title: "Churn Predictor",
    description:
      "Predice la probabilita' di abbandono cliente nei prossimi 90 giorni dato profilo + offerta + market reference. Output con driver explanation + azioni consigliate per retention. Wave 5.",
    features: [
      "Gauge probabilita' + 4 risk level (low/med/high/critical)",
      "Top 5 driver con contribution share",
      "Azioni consigliate ranked per ROI (lift/cost)",
      "Batch upload CSV portfolio (Pro)",
    ],
    status: "in arrivo",
    tier: "Pro / Enterprise",
    tryDemoHref: "/it/pro/marketing?tab=churn",
    icon: AlertTriangle,
    accentClass: "from-orange-50/60 to-card",
  },
  {
    number: "06",
    title: "Win-back Optimizer",
    description:
      "Strategie ranked per riconquistare ex-clienti persi: 3 offerte (discount, lock fisso, bundle) con acceptance probability + LTV atteso + payback months. ROI-driven, demo 1 strategia unlocked.",
    features: [
      "3 strategie con probabilita' di accettazione",
      "LTV atteso 36 mesi + payback months",
      "Time decay: minor accept se piu' di 12 mesi",
      "A/B test offerte + email sequences (Pro)",
    ],
    status: "in arrivo",
    tier: "Pro / Enterprise",
    tryDemoHref: "/it/pro/marketing?tab=winback",
    icon: Heart,
    accentClass: "from-pink-50/60 to-card",
  },
  {
    number: "07",
    title: "Dynamic Pricing",
    description:
      "Price ladder ottimale per cluster cliente dato competitor benchmark live. Output: 3 punti (aggressive/balanced/premium) con take-rate + margine atteso. Demo 1 cluster (PMI), altri 4 lockati.",
    features: [
      "5 cluster preset (PMI, domestico, industriale, vulnerabili, HORECA)",
      "Take-rate model elasticita'-aware",
      "Optimal point highlight per max margine",
      "Scheduling settimanale + A/B test (Pro)",
    ],
    status: "in arrivo",
    tier: "Pro / Enterprise",
    tryDemoHref: "/it/pro/marketing?tab=pricing",
    icon: Sliders,
    accentClass: "from-indigo-50/60 to-card",
  },
  {
    number: "08",
    title: "Quote Builder",
    description:
      "Quote PDF pronto in 30 secondi: scegli template (PMI fisso, domestico variabile, industriale fisso 24m), inserisci cliente + consumo, click stampa. Per sales in chiamata. Demo: 1 template, watermark DEMO.",
    features: [
      "3 template preset (PMI / Domestico / Industriale)",
      "Auto-fill da forecast PUN + spread per categoria",
      "Branding custom logo + colore (Pro)",
      "Salvataggio per cliente + distribuzione email (Pro)",
    ],
    status: "in arrivo",
    tier: "Pro / Enterprise",
    tryDemoHref: "/it/pro/marketing?tab=quote",
    icon: ClipboardSignature,
    accentClass: "from-teal-50/60 to-card",
  },
  {
    number: "09",
    title: "CTE Builder",
    description:
      "Genera Condizioni Tecnico Economiche conformi ARERA in pochi minuti. Wizard 8 step + validazione real-time su 23 check ARERA + auto-calcolo Scheda Confrontabilità su 8 profili tipo + PDF stampabile multi-sezione. Demo: 1 template Luce variabile, watermark DEMO, no branding custom.",
    features: [
      "Validazione 23 check ARERA (Del. 302/2016, 569/2019, 25/2025)",
      "Scheda Sintetica + Scheda Confrontabilità auto-generate",
      "Calcolo spesa stimata su 8 profili tipo standard ARERA",
      "Submission Portale Offerte ARERA (Enterprise)",
    ],
    status: "in arrivo",
    tier: "Enterprise",
    tryDemoHref: "/it/pro/marketing?tab=cte-builder",
    icon: FileCheck2,
    accentClass: "from-violet-50/60 to-card",
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
          Trading vitals, risk &amp; hedging, backtest engine + margin simulator, forecast a 24 mesi con
          scenari, report PDF brandizzati. Lo stack analytics per <strong className="text-foreground">trader</strong>,{" "}
          <strong className="text-foreground">fornitori</strong>, broker e PMI energivore — costruito sui dati e sui
          modelli di Energy Index.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href="#early-access"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.02]"
          >
            Avvisami al lancio
          </a>
        </div>
      </header>

      {/* DEPARTMENT SELECTOR — porta l'utente alla mega-card giusta */}
      <section className="space-y-5">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-center">
          Qual e&apos; il tuo dipartimento in azienda?
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-xl mx-auto">
          Scegli il percorso giusto: ti portiamo direttamente ai tool che servono al tuo team.
        </p>
        <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
          <a
            href="#trading"
            className="group relative overflow-hidden rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/60 via-card to-card p-6 sm:p-8 flex flex-col gap-2 transition-all hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-0.5"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl"
            />
            <div className="relative flex items-baseline gap-2">
              <TrendingUp className="h-6 w-6 text-emerald-700" aria-hidden />
              <span className="text-3xl md:text-4xl font-black tracking-tight">Trading</span>
            </div>
            <p className="relative text-sm text-muted-foreground">
              Trader, risk manager, asset manager. Spark spread, ATR, VaR, backtest engine.
            </p>
          </a>

          <a
            href="#marketing"
            className="group relative overflow-hidden rounded-3xl border-2 border-sky-500/40 bg-gradient-to-br from-sky-50/60 via-card to-card p-6 sm:p-8 flex flex-col gap-2 transition-all hover:border-sky-500 hover:shadow-xl hover:shadow-sky-500/20 hover:-translate-y-0.5"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-400/15 blur-3xl"
            />
            <div className="relative flex items-baseline gap-2">
              <Users className="h-6 w-6 text-sky-700" aria-hidden />
              <span className="text-3xl md:text-4xl font-black tracking-tight">Marketing</span>
            </div>
            <p className="relative text-sm text-muted-foreground">
              Fornitori, broker, team commerciali. Margin simulator, customer simulator, forecast, report.
            </p>
          </a>
        </div>
      </section>

      {/* MEGA-CARD TRADING */}
      <section id="trading" className="scroll-mt-20">
        <Link href="/it/pro/trading" className="group block">
          <article className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/60 via-card to-card p-8 sm:p-10 space-y-6 transition-all group-hover:border-emerald-500/60 group-hover:shadow-xl group-hover:shadow-emerald-500/20 group-hover:-translate-y-0.5">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-400/10 blur-3xl"
            />

            <header className="relative space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                Per trader e risk manager
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Trading</h2>
                <span className="inline-flex items-center rounded-md bg-gradient-to-br from-amber-300 to-amber-500 px-2 py-0.5 text-[11px] font-black tracking-[0.18em] text-stone-900 shadow-sm ring-1 ring-amber-600/20">
                  PRO
                </span>
              </div>
              <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
                Dashboard purpose-built per chi tradera&apos; PUN/PSV/TTF: spark spread italiano, cross
                spreads, volatility ATR, correlation matrix, portfolio mark-to-market, VaR e stress
                test. Niente Bloomberg da 22k€/anno.
              </p>
            </header>

            <div className="relative grid gap-3 grid-cols-2 lg:grid-cols-4">
              <MiniToolTile icon={Activity} label="Trading Vitals" status="live" wave="Wave 1" />
              <MiniToolTile icon={Shield} label="Risk & Hedging" status="live" wave="Wave 2" />
              <MiniToolTile icon={FlaskConical} label="Backtest engine" status="live" wave="Wave 3" />
              <MiniToolTile icon={BellRing} label="Alert & API" status="live" wave="Wave 4" />
            </div>

            <div className="relative pt-2">
              <span className="inline-flex items-center justify-center px-10 py-5 rounded-2xl bg-emerald-600 text-white text-lg md:text-xl font-bold shadow-xl shadow-emerald-600/30 transition-all group-hover:bg-emerald-500 group-hover:shadow-emerald-500/50 group-hover:scale-[1.03]">
                Apri Trading Desk
              </span>
              <p className="text-xs text-muted-foreground mt-3">
                Disponibile su:{" "}
                <span className="font-semibold text-foreground">
                  Trading 999€/mese · Enterprise
                </span>
              </p>
            </div>
          </article>
        </Link>
      </section>

      {/* MEGA-CARD MARKETING */}
      <section id="marketing" className="scroll-mt-20">
        <Link href="/it/pro/marketing" className="group block">
          <article className="relative overflow-hidden rounded-3xl border-2 border-sky-500/30 bg-gradient-to-br from-sky-50/60 via-card to-card p-8 sm:p-10 space-y-6 transition-all group-hover:border-sky-500/60 group-hover:shadow-xl group-hover:shadow-sky-500/20 group-hover:-translate-y-0.5">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-sky-400/10 blur-3xl"
            />

            <header className="relative space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-sky-700 dark:text-sky-300">
                Per fornitori e team commerciali
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Marketing</h2>
                <span className="inline-flex items-center rounded-md bg-gradient-to-br from-amber-300 to-amber-500 px-2 py-0.5 text-[11px] font-black tracking-[0.18em] text-stone-900 shadow-sm ring-1 ring-amber-600/20">
                  PRO
                </span>
              </div>
              <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
                Tool per chi vende energia: simula il margine di un&apos;offerta, trova quale offerta
                del mercato libero costerebbe meno al cliente, modella scenari sul forecast, genera
                report PDF brandizzati per i clienti.
              </p>
            </header>

            <div className="relative grid gap-4 md:grid-cols-2">
              {MARKETING_MODULES.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.number}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-all group-hover:border-sky-500/30"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-sky-700/60">{m.number}</span>
                        <h3 className="text-base font-bold truncate">{m.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="relative pt-2">
              <span className="inline-flex items-center justify-center px-10 py-5 rounded-2xl bg-sky-600 text-white text-lg md:text-xl font-bold shadow-xl shadow-sky-600/30 transition-all group-hover:bg-sky-500 group-hover:shadow-sky-500/50 group-hover:scale-[1.03]">
                Apri Marketing Desk
              </span>
              <p className="text-xs text-muted-foreground mt-3">
                Disponibile su:{" "}
                <span className="font-semibold text-foreground">Pro 499€/mese · Enterprise</span>
              </p>
            </div>
          </article>
        </Link>
      </section>

      {/* MEGA CTA CAROUSEL — auto-rotate demo per Margin / Customer / Churn */}
      <MegaCTACarousel />

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

      {/* PRICING */}
      <PricingSection tiers={TIERS} />

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

function MiniToolTile({
  icon: Icon,
  label,
  status,
  wave,
}: {
  icon: LucideIcon;
  label: string;
  status: "live" | "locked";
  wave: string;
}) {
  const isLocked = status === "locked";
  return (
    <div
      className={`rounded-2xl border p-4 flex flex-col gap-2 ${
        isLocked
          ? "border-amber-300/30 bg-amber-50/30 opacity-80"
          : "border-emerald-500/30 bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon
          className={`h-5 w-5 ${isLocked ? "text-amber-700" : "text-emerald-700"}`}
          aria-hidden
        />
        {isLocked && <Lock className="h-3.5 w-3.5 text-amber-600" aria-hidden />}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">{wave}</div>
        <div className="text-sm font-bold text-stone-900">{label}</div>
      </div>
    </div>
  );
}
