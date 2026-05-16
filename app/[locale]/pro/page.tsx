import type { Metadata } from "next";
import Link from "next/link";
import { LeadCaptureForm } from "@/components/pro/LeadCaptureForm";
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
];

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
}

const TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "0",
    period: "€/mese",
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
    price: "149",
    period: "€/mese",
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
    price: "3.500",
    period: "€/mese",
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
            offers: TIERS.filter((t) => t.name !== "Free").map((t) => ({
              "@type": "Offer",
              name: `EIDX Pro ${t.name}`,
              price: t.price,
              priceCurrency: "EUR",
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: t.price,
                priceCurrency: "EUR",
                unitText: "MONTH",
              },
              availability: "https://schema.org/PreOrder",
              url: "https://energyindex.it/it/pro#early-access",
            })),
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

      {/* MODULI */}
      <section className="space-y-8">
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Tre moduli, un singolo workflow</h2>
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
            </article>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="space-y-8">
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Pricing trasparente</h2>
          <p className="text-muted-foreground">
            Nessun trial gratis ingannevole, nessuna sales call obbligatoria. Vedi cosa paghi prima di
            comprare.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {TIERS.map((t) => (
            <article
              key={t.name}
              className={`rounded-2xl border p-8 space-y-5 transition-all ${
                t.highlight
                  ? "border-primary bg-primary/5 shadow-xl shadow-primary/10 lg:-translate-y-2"
                  : "bg-card hover:border-primary/40"
              }`}
            >
              {t.highlight && (
                <div className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary-foreground">
                  Piu&apos; richiesto
                </div>
              )}
              <h3 className="text-2xl font-bold">{t.name}</h3>
              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tabular-nums">{t.price}</span>
                  <span className="text-sm text-muted-foreground">{t.period}</span>
                </div>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </div>
              <ul className="space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-baseline gap-2">
                    <span className="text-primary mt-0.5" aria-hidden>
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={t.ctaHref}
                className={`block w-full text-center rounded-md px-6 py-3 text-sm font-semibold transition-all ${
                  t.highlight
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:scale-[1.02]"
                    : "border border-border bg-card hover:bg-accent"
                }`}
              >
                {t.ctaLabel}
              </a>
            </article>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center pt-2">
          Tutti i prezzi sono al netto di IVA. Fatturazione mensile, no contratto annuale obbligatorio.
          Custom Research disponibile da 5.000€ a 25.000€ a progetto.
        </p>
      </section>

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
