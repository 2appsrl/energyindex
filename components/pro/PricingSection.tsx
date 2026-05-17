"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

export type BillingPeriod = "mensile" | "annuale";

export interface PricingTierData {
  name: string;
  monthlyPriceEur: number; // 0 per Free
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
  isFree?: boolean;
}

export const ANNUAL_DISCOUNT_PCT = 0.15;

const NUM = new Intl.NumberFormat("it-IT");

function formatEur(n: number): string {
  return NUM.format(Math.round(n));
}

export function PricingSection({ tiers }: { tiers: PricingTierData[] }) {
  const [period, setPeriod] = useState<BillingPeriod>("mensile");

  function handleToggle(p: BillingPeriod) {
    if (p !== period) {
      setPeriod(p);
      trackEvent("eidx_pro_pricing_toggle", { period: p });
    }
  }

  return (
    <section className="space-y-8">
      <div className="space-y-2 max-w-2xl">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Pricing trasparente</h2>
        <p className="text-muted-foreground">
          Nessun trial gratis ingannevole, nessuna sales call obbligatoria. Vedi cosa paghi prima di comprare.
        </p>
      </div>

      {/* Toggle Mensile / Annuale */}
      <div className="flex justify-center">
        <div className="inline-flex items-center p-1 bg-muted rounded-full">
          {(["mensile", "annuale"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleToggle(p)}
              aria-pressed={p === period}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                p === period
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "mensile" ? "Mensile" : "Annuale"}
              {p === "annuale" && (
                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  −15%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {tiers.map((t) => {
          const isFree = t.isFree ?? t.monthlyPriceEur === 0;
          const annualTotal = t.monthlyPriceEur * 12 * (1 - ANNUAL_DISCOUNT_PCT);
          const annualSavings = t.monthlyPriceEur * 12 * ANNUAL_DISCOUNT_PCT;
          const effectiveMonthly =
            isFree
              ? 0
              : period === "annuale"
                ? annualTotal / 12
                : t.monthlyPriceEur;

          return (
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
                  <span className="text-4xl font-bold tabular-nums">
                    {isFree ? "0" : formatEur(effectiveMonthly)}
                  </span>
                  <span className="text-sm text-muted-foreground">€/mese</span>
                </div>
                {!isFree && period === "annuale" && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    Fatturato annualmente: {formatEur(annualTotal)} €/anno · risparmi {formatEur(annualSavings)} €
                  </p>
                )}
                {!isFree && period === "mensile" && (
                  <p className="text-xs text-muted-foreground">
                    Disdicibile in qualsiasi momento
                  </p>
                )}
                <p className="text-sm text-muted-foreground pt-1">{t.description}</p>
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
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        Tutti i prezzi al netto di IVA. Piano mensile disdicibile in qualsiasi momento; piano annuale con sconto 15%. Custom Research disponibile da 5.000€ a 25.000€ a progetto.
      </p>
    </section>
  );
}
