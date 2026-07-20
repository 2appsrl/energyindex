"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Lock, TrendingDown, TrendingUp } from "lucide-react";
import { DemoLockBanner } from "./DemoLockBanner";
import {
  predictChurn,
  type ChurnInputs,
  type CustomerSegment,
  type OfferType,
} from "@/lib/pro/churn-math";

const NUM0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const EUR0 = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const DEFAULT_INPUTS: ChurnInputs = {
  segment: "pmi",
  annualKwh: 250_000,
  offerType: "variabile",
  contractAgeMonths: 14,
  currentPriceEurPerMwh: 135,
  marketPunEurPerMwh: 110,
};

export interface ChurnPredictorViewProps {
  /** PUN spot di riferimento dal server (override del default) */
  marketPunEurPerMwh: number;
}

export function ChurnPredictorView({ marketPunEurPerMwh }: ChurnPredictorViewProps) {
  const [inputs, setInputs] = useState<ChurnInputs>({
    ...DEFAULT_INPUTS,
    marketPunEurPerMwh,
  });

  const result = useMemo(() => predictChurn(inputs), [inputs]);

  return (
    <div className="space-y-4">
      <DemoLockBanner
        icon={AlertTriangle}
        title="Demo: 1 simulazione live, 2 azioni consigliate lockate, no batch upload CSV."
        description="Tier Pro 499€/mese: upload portfolio CSV (1000+ clienti), batch scoring, alert automatici quando un cliente passa a 'high risk', integrazione CRM."
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* INPUT PANEL */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-5 h-fit">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Profilo cliente
          </h2>

          <Field label="Segmento">
            <select
              value={inputs.segment}
              onChange={(e) =>
                setInputs({ ...inputs, segment: e.target.value as CustomerSegment })
              }
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="domestico">Domestico</option>
              <option value="pmi">PMI</option>
              <option value="industriale">Industriale</option>
            </select>
          </Field>

          <Field
            label={`Consumo annuo (${NUM0.format(inputs.annualKwh)} kWh)`}
          >
            <input
              type="range"
              min={0}
              max={5_000_000}
              step={1000}
              value={inputs.annualKwh}
              onChange={(e) => setInputs({ ...inputs, annualKwh: Number(e.target.value) })}
              className="w-full accent-emerald-700"
              aria-label="Consumo annuo kWh"
            />
            <div className="flex justify-between text-[10px] text-stone-400 tabular-nums">
              <span>0</span>
              <span>5M kWh</span>
            </div>
          </Field>

          <Field label="Tipo offerta attuale">
            <select
              value={inputs.offerType}
              onChange={(e) =>
                setInputs({ ...inputs, offerType: e.target.value as OfferType })
              }
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="fisso">Fisso (lock-in prezzo)</option>
              <option value="variabile">Variabile (passthrough PUN)</option>
            </select>
          </Field>

          <Field label={`Eta' contratto (${inputs.contractAgeMonths} mesi)`}>
            <input
              type="range"
              min={0}
              max={60}
              step={1}
              value={inputs.contractAgeMonths}
              onChange={(e) =>
                setInputs({ ...inputs, contractAgeMonths: Number(e.target.value) })
              }
              className="w-full accent-emerald-700"
              aria-label="Eta' contratto in mesi"
            />
            <div className="flex justify-between text-[10px] text-stone-400 tabular-nums">
              <span>0</span>
              <span>5 anni</span>
            </div>
          </Field>

          <Field label="Prezzo attuale pagato (€/MWh)">
            <input
              type="number"
              min={0}
              step={1}
              value={inputs.currentPriceEurPerMwh}
              onChange={(e) =>
                setInputs({
                  ...inputs,
                  currentPriceEurPerMwh: Number(e.target.value),
                })
              }
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-mono tabular-nums"
            />
          </Field>

          <div className="pt-3 border-t border-stone-200 text-xs text-stone-500">
            <p>
              PUN spot riferimento:{" "}
              <strong className="text-stone-700 tabular-nums">
                {inputs.marketPunEurPerMwh.toFixed(0)} €/MWh
              </strong>
            </p>
            <p className="mt-1">
              Gap cliente vs mercato:{" "}
              <strong
                className={`tabular-nums ${
                  inputs.currentPriceEurPerMwh > inputs.marketPunEurPerMwh
                    ? "text-rose-700"
                    : "text-emerald-700"
                }`}
              >
                {inputs.currentPriceEurPerMwh > inputs.marketPunEurPerMwh ? "+" : ""}
                {(
                  ((inputs.currentPriceEurPerMwh - inputs.marketPunEurPerMwh) /
                    inputs.marketPunEurPerMwh) *
                  100
                ).toFixed(1)}
                %
              </strong>
            </p>
          </div>
        </div>

        {/* OUTPUT */}
        <div className="space-y-5 min-w-0">
          <ChurnGauge probability={result.probability} riskLevel={result.riskLevel} />

          <DriversBreakdown drivers={result.drivers} />

          <ActionsList actions={result.recommendedActions} />

          {/* LOCKED FEATURES */}
          <div className="grid gap-3 sm:grid-cols-3 pt-2">
            <LockedFeature
              title="Batch upload CSV"
              description="Scoring portfolio fino a 10.000 clienti in una run, output CSV ranked."
            />
            <LockedFeature
              title="Alert automatici"
              description="Quando un cliente passa a high-risk, email/Slack al sales team."
            />
            <LockedFeature
              title="Integrazione CRM"
              description="Webhook Salesforce / HubSpot per attivare playbook retention."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CHURN GAUGE
// ============================================================

function ChurnGauge({
  probability,
  riskLevel,
}: {
  probability: number;
  riskLevel: "low" | "medium" | "high" | "critical";
}) {
  const pct = Math.round(probability * 100);
  const colors = {
    low: { fg: "stroke-emerald-600", text: "text-emerald-700", bg: "bg-emerald-50", chip: "bg-emerald-100 text-emerald-800" },
    medium: { fg: "stroke-amber-500", text: "text-amber-700", bg: "bg-amber-50", chip: "bg-amber-100 text-amber-800" },
    high: { fg: "stroke-orange-600", text: "text-orange-700", bg: "bg-orange-50", chip: "bg-orange-100 text-orange-800" },
    critical: { fg: "stroke-rose-600", text: "text-rose-700", bg: "bg-rose-50", chip: "bg-rose-100 text-rose-800" },
  } as const;
  const c = colors[riskLevel];

  // SVG gauge (semicerchio)
  const radius = 80;
  const circumference = Math.PI * radius;
  const dash = (pct / 100) * circumference;

  const labels = { low: "Basso", medium: "Medio", high: "Alto", critical: "Critico" } as const;

  return (
    <section className={`rounded-2xl border border-stone-200 ${c.bg} p-6`}>
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-semibold text-stone-900">Probabilita&apos; di churn (90 giorni)</h2>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${c.chip}`}>
          rischio {labels[riskLevel]}
        </span>
      </div>
      <div className="flex items-center gap-6 flex-wrap">
        <div className="relative">
          <svg width="200" height="115" viewBox="0 0 200 115" aria-hidden>
            {/* track */}
            <path
              d={`M 20 100 A ${radius} ${radius} 0 0 1 180 100`}
              fill="none"
              className="stroke-stone-200"
              strokeWidth="14"
              strokeLinecap="round"
            />
            {/* fill */}
            <path
              d={`M 20 100 A ${radius} ${radius} 0 0 1 180 100`}
              fill="none"
              className={c.fg}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
            <span className={`text-5xl font-bold tabular-nums ${c.text}`}>{pct}%</span>
            <span className="text-xs text-stone-500">prob. churn</span>
          </div>
        </div>
        <div className="flex-1 min-w-[180px] text-sm text-stone-700 space-y-1">
          {riskLevel === "low" && (
            <p>
              ✅ Cliente <strong>fedele</strong>. Mantieni il status quo, monitora.
            </p>
          )}
          {riskLevel === "medium" && (
            <p>
              ⚠ Cliente <strong>a rischio moderato</strong>. Valuta proattivamente azioni
              di retention.
            </p>
          )}
          {riskLevel === "high" && (
            <p>
              🔴 Cliente <strong>ad alto rischio</strong>. Agire entro 30 giorni con
              offerta personalizzata.
            </p>
          )}
          {riskLevel === "critical" && (
            <p>
              🔴🔴 <strong>Probabile churn imminente</strong>. Call retention entro 7
              giorni o offerta rinnovo aggressiva.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// DRIVERS BREAKDOWN
// ============================================================

function DriversBreakdown({
  drivers,
}: {
  drivers: Array<{ label: string; contributionPct: number; direction: "increase" | "decrease" | "neutral" }>;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
      <h2 className="font-semibold text-stone-900">Driver del rischio</h2>
      <ul className="space-y-2">
        {drivers.map((d, i) => (
          <li key={i} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-stone-700 inline-flex items-center gap-1.5">
                {d.direction === "increase" && (
                  <TrendingUp className="h-3.5 w-3.5 text-rose-600" aria-hidden />
                )}
                {d.direction === "decrease" && (
                  <TrendingDown className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                )}
                {d.direction === "neutral" && (
                  <span className="h-3.5 w-3.5 inline-block" aria-hidden />
                )}
                {d.label}
              </span>
              <span className="text-xs font-bold tabular-nums text-stone-500">
                {d.contributionPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  d.direction === "increase"
                    ? "bg-rose-500"
                    : d.direction === "decrease"
                      ? "bg-emerald-500"
                      : "bg-stone-400"
                }`}
                style={{ width: `${Math.min(100, d.contributionPct)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ============================================================
// ACTIONS LIST
// ============================================================

function ActionsList({
  actions,
}: {
  actions: Array<{
    id: string;
    label: string;
    description: string;
    expectedLiftPp: number;
    costEur: number;
    locked: boolean;
  }>;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
      <h2 className="font-semibold text-stone-900">Azioni consigliate</h2>
      <ul className="space-y-3">
        {actions.map((a, i) => (
          <li
            key={a.id}
            className={`rounded-xl border p-4 ${
              a.locked
                ? "border-amber-300/50 bg-amber-50/30"
                : "border-emerald-300/50 bg-emerald-50/30"
            }`}
          >
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
              <h3 className="font-semibold text-stone-900 inline-flex items-center gap-2">
                <span className="text-xs font-mono text-stone-400">{i + 1}.</span>
                {a.locked && <Lock className="h-3.5 w-3.5 text-amber-600" aria-hidden />}
                {a.label}
              </h3>
              {a.locked && (
                <Link
                  href="/it/pro#early-access"
                  className="text-[10px] font-bold uppercase text-amber-700 hover:text-amber-900 underline"
                >
                  Sblocca Pro 499€
                </Link>
              )}
            </div>
            <p
              className={`text-sm ${
                a.locked ? "blur-[2px] select-none pointer-events-none" : "text-stone-700"
              }`}
              aria-hidden={a.locked || undefined}
            >
              {a.description}
            </p>
            <div className="mt-2 flex items-baseline gap-4 text-xs">
              <span className="text-stone-500">
                Lift atteso:{" "}
                <strong
                  className={`tabular-nums ${
                    a.locked ? "text-stone-400 blur-[2px] select-none" : "text-emerald-700"
                  }`}
                >
                  -{(a.expectedLiftPp * 100).toFixed(0)}pp
                </strong>
              </span>
              <span className="text-stone-500">
                Costo/cliente:{" "}
                <strong
                  className={`tabular-nums ${
                    a.locked ? "text-stone-400 blur-[2px] select-none" : "text-stone-700"
                  }`}
                >
                  {EUR0.format(a.costEur)}
                </strong>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ============================================================
// SHARED HELPERS
// ============================================================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-stone-700">{label}</label>
      {children}
    </div>
  );
}

function LockedFeature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/40 p-4 flex items-start gap-3 opacity-75">
      <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
      <div className="space-y-0.5">
        <p className="text-sm font-bold text-stone-700">{title}</p>
        <p className="text-xs text-stone-600">{description}</p>
      </div>
    </div>
  );
}

