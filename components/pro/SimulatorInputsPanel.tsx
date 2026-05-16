"use client";

import { useState } from "react";
import type { ContractType, SimulatorInputs } from "@/lib/pro/margin-math";

const NUM_INT = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const NUM_1DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type Tipologia = "pmi" | "famiglia" | "grande";

const TIPOLOGIA_DEFAULTS: Record<Tipologia, { label: string; volume: number }> = {
  famiglia: { label: "Famiglia residenziale", volume: 3_500 },
  pmi: { label: "PMI commerciale", volume: 250_000 },
  grande: { label: "Grande utenza", volume: 5_000_000 },
};

export function SimulatorInputsPanel({
  inputs,
  onChange,
}: {
  inputs: SimulatorInputs;
  onChange: (next: SimulatorInputs) => void;
}) {
  const [tipologia, setTipologia] = useState<Tipologia>("pmi");

  const suggestedVolume = TIPOLOGIA_DEFAULTS[tipologia].volume;
  const showSuggestion = inputs.volumeKwhPerYear !== suggestedVolume;

  function patch(p: Partial<SimulatorInputs>) {
    onChange({ ...inputs, ...p });
  }

  return (
    <aside className="bg-white rounded-xl border border-stone-200 p-6 space-y-6 self-start lg:sticky lg:top-6">
      <div data-tour="inputs" className="space-y-6">
      <div>
        <h2 className="text-sm font-bold tracking-wide text-stone-500 uppercase">
          Input cliente
        </h2>
      </div>

      <Field label="Tipologia">
        <select
          value={tipologia}
          onChange={(e) => setTipologia(e.target.value as Tipologia)}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {(Object.keys(TIPOLOGIA_DEFAULTS) as Tipologia[]).map((k) => (
            <option key={k} value={k}>
              {TIPOLOGIA_DEFAULTS[k].label}
            </option>
          ))}
        </select>
        {showSuggestion && (
          <button
            type="button"
            onClick={() => patch({ volumeKwhPerYear: suggestedVolume })}
            className="mt-1 text-xs text-emerald-700 underline hover:text-emerald-800"
          >
            Usa {NUM_INT.format(suggestedVolume)} kWh
          </button>
        )}
      </Field>

      <Field label="Volume annuo (kWh)">
        <input
          type="number"
          min={0}
          step={100}
          value={inputs.volumeKwhPerYear}
          onChange={(e) =>
            patch({ volumeKwhPerYear: Math.max(0, Number(e.target.value) || 0) })
          }
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <p className="mt-1 text-xs text-stone-500 tabular-nums">
          {NUM_INT.format(inputs.volumeKwhPerYear)} kWh/anno
        </p>
      </Field>

      <Field label="Durata contratto">
        <select
          value={inputs.contractMonths}
          onChange={(e) => patch({ contractMonths: Number(e.target.value) })}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value={6}>6 mesi</option>
          <option value={12}>12 mesi</option>
          <option value={18}>18 mesi</option>
          <option value={24}>24 mesi</option>
        </select>
      </Field>

      </div>

      <div className="pt-4 border-t border-stone-200 space-y-6">
        <h2 className="text-sm font-bold tracking-wide text-stone-500 uppercase">
          Pricing
        </h2>

        <div data-tour="contract-type" className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
            Tipo contratto
          </label>
          <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-md">
            {(
              [
                { value: "variabile", label: "Variabile" },
                { value: "fisso", label: "Fisso" },
              ] as { value: ContractType; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => patch({ contractType: opt.value })}
                aria-pressed={inputs.contractType === opt.value}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  inputs.contractType === opt.value
                    ? "bg-white shadow-sm text-stone-900"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500 leading-snug">
            {inputs.contractType === "variabile"
              ? "Passthrough PUN: il cliente assorbe le variazioni di mercato."
              : "Lock-in: tu assorbi il rischio prezzo. Cost shock riduce il margine."}
          </p>
        </div>

        <div data-tour="pricing" className="space-y-6">
          <SliderField
            label="Spread vendita"
            min={0}
            max={100}
            step={0.5}
            value={inputs.spreadEurPerMwh}
            format={(v) => `+${NUM_1DP.format(v)} €/MWh`}
            onChange={(v) => patch({ spreadEurPerMwh: v })}
          />

          <SliderField
            label="CAC stimato"
            min={0}
            max={500}
            step={10}
            value={inputs.cacEur}
            format={(v) => `${NUM_INT.format(v)} €`}
            onChange={(v) => patch({ cacEur: v })}
          />

          <SliderField
            label="Churn atteso"
            min={0}
            max={30}
            step={0.5}
            value={inputs.churnAnnualPct * 100}
            format={(v) => `${NUM_1DP.format(v)} %`}
            onChange={(v) => patch({ churnAnnualPct: v / 100 })}
          />
        </div>
      </div>
    </aside>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-stone-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function SliderField({
  label,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-stone-700">{label}</span>
        <span className="text-xs font-bold tabular-nums text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-2 accent-emerald-600"
        aria-label={label}
      />
      <div className="flex justify-between text-[10px] text-stone-400 tabular-nums">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
