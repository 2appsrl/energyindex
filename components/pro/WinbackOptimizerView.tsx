"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Lock } from "lucide-react";
import { DemoLockBanner } from "./DemoLockBanner";
import {
  computeWinback,
  type WinbackInputs,
  type CustomerSegment,
} from "@/lib/pro/winback-math";

const NUM0 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const EUR0 = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const DEFAULT_INPUTS: WinbackInputs = {
  segment: "pmi",
  previousPriceEurPerMwh: 140,
  annualKwh: 250_000,
  monthsSinceLost: 3,
  competitorPriceEurPerMwh: 130,
};

export function WinbackOptimizerView() {
  const [inputs, setInputs] = useState<WinbackInputs>(DEFAULT_INPUTS);
  const result = useMemo(() => computeWinback(inputs), [inputs]);

  return (
    <div className="space-y-4">
      <DemoLockBanner
        icon={Heart}
        title="Demo: vedi solo l'offerta #1 ranked per ROI. Le altre 2 strategie lockate."
        description="Tier Pro 499€/mese: tutte le 3 strategie sbloccate, A/B test offerte, sequenze email automatiche di riconquista (3-touch), tracking conversion."
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* INPUT */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-5 h-fit">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Profilo cliente perso
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

          <Field label={`Consumo annuo (${NUM0.format(inputs.annualKwh)} kWh)`}>
            <input
              type="range"
              min={0}
              max={5_000_000}
              step={1000}
              value={inputs.annualKwh}
              onChange={(e) => setInputs({ ...inputs, annualKwh: Number(e.target.value) })}
              className="w-full accent-emerald-700"
              aria-label="Consumo annuo"
            />
          </Field>

          <Field label="Prezzo che pagava prima (€/MWh)">
            <input
              type="number"
              min={0}
              step={1}
              value={inputs.previousPriceEurPerMwh}
              onChange={(e) =>
                setInputs({ ...inputs, previousPriceEurPerMwh: Number(e.target.value) })
              }
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-mono tabular-nums"
            />
          </Field>

          <Field label="Prezzo che paga ora col competitor (€/MWh)">
            <input
              type="number"
              min={0}
              step={1}
              value={inputs.competitorPriceEurPerMwh}
              onChange={(e) =>
                setInputs({
                  ...inputs,
                  competitorPriceEurPerMwh: Number(e.target.value),
                })
              }
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-mono tabular-nums"
            />
          </Field>

          <Field label={`Mesi dalla perdita (${inputs.monthsSinceLost} mesi)`}>
            <input
              type="range"
              min={0}
              max={36}
              step={1}
              value={inputs.monthsSinceLost}
              onChange={(e) =>
                setInputs({ ...inputs, monthsSinceLost: Number(e.target.value) })
              }
              className="w-full accent-emerald-700"
              aria-label="Mesi dalla perdita"
            />
            <div className="flex justify-between text-[10px] text-stone-400 tabular-nums">
              <span>0</span>
              <span>3 anni</span>
            </div>
          </Field>
        </div>

        {/* OUTPUT */}
        <div className="space-y-5 min-w-0">
          {/* Not-winnable headline */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 flex items-baseline justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xs uppercase tracking-wide text-stone-500 font-semibold">
                Probabilita&apos; di non riconquistarlo
              </h2>
              <p className="text-3xl font-bold tabular-nums text-stone-900 mt-1">
                {(result.notWinnableProb * 100).toFixed(0)}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500">Best acceptance rate</p>
              <p className="text-lg font-semibold tabular-nums text-emerald-700">
                {((1 - result.notWinnableProb) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-stone-500">con strategia #1 sotto</p>
            </div>
          </section>

          {/* OFFERS */}
          <section className="space-y-3">
            <h2 className="font-semibold text-stone-900">Strategie ranked per ROI</h2>
            <div className="space-y-3">
              {result.offers.map((o, i) => (
                <OfferCard key={o.strategy} offer={o} rank={i + 1} />
              ))}
            </div>
          </section>

          {/* LOCKED FEATURES */}
          <div className="grid gap-3 sm:grid-cols-3 pt-2">
            <LockedFeature
              title="A/B test offerte"
              description="Split di customer base in 2 gruppi, test offerta A vs B, conversion lift."
            />
            <LockedFeature
              title="Sequenze email automatiche"
              description="3-touch email cadence con personalizzazione segmento + script call agent."
            />
            <LockedFeature
              title="Tracking conversion"
              description="Dashboard win-rate per segmento + ROI cumulato campagna."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function OfferCard({
  offer,
  rank,
}: {
  offer: ReturnType<typeof computeWinback>["offers"][number];
  rank: number;
}) {
  return (
    <article
      className={`rounded-xl border p-5 space-y-3 ${
        offer.locked
          ? "border-amber-300/50 bg-amber-50/30"
          : "border-emerald-300/50 bg-emerald-50/30"
      }`}
    >
      <header className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-stone-900 inline-flex items-center gap-2">
          <span className="text-xs font-mono text-stone-400">#{rank}</span>
          {offer.locked && <Lock className="h-3.5 w-3.5 text-amber-600" aria-hidden />}
          {offer.label}
        </h3>
        {offer.locked && (
          <Link
            href="/it/pro#early-access"
            className="text-[10px] font-bold uppercase text-amber-700 hover:text-amber-900 underline"
          >
            Sblocca Pro 499€
          </Link>
        )}
      </header>

      <p
        className={`text-sm text-stone-700 ${
          offer.locked ? "blur-[2px] select-none pointer-events-none" : ""
        }`}
        aria-hidden={offer.locked || undefined}
      >
        {offer.description}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-stone-200/50">
        <Stat
          label="Prezzo proposto"
          value={`${offer.proposedPriceEurPerMwh.toFixed(1)} €/MWh`}
          locked={offer.locked}
        />
        <Stat
          label="Acceptance"
          value={`${(offer.acceptanceProb * 100).toFixed(0)}%`}
          locked={offer.locked}
          highlight={!offer.locked}
        />
        <Stat
          label="LTV atteso"
          value={EUR0.format(offer.expectedNetLtvEur)}
          locked={offer.locked}
          highlight={!offer.locked}
        />
        <Stat
          label="Payback"
          value={
            Number.isFinite(offer.paybackMonths)
              ? `${offer.paybackMonths.toFixed(0)} mesi`
              : "n/a"
          }
          locked={offer.locked}
        />
      </div>
    </article>
  );
}

function Stat({
  label,
  value,
  locked,
  highlight,
}: {
  label: string;
  value: string;
  locked: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">
        {label}
      </p>
      <p
        className={`text-sm font-bold tabular-nums ${
          locked
            ? "text-stone-400 blur-[2px] select-none"
            : highlight
              ? "text-emerald-700"
              : "text-stone-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

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
