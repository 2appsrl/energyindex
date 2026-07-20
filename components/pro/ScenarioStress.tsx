import { Lock } from "lucide-react";
import type {
  KpiResult,
  ScenarioModifier,
  WhatIfShocks,
} from "@/lib/pro/margin-math";
import { NO_SHOCKS } from "@/lib/pro/margin-math";
import { InfoTooltip } from "./InfoTooltip";

/**
 * Scenari lockati nel demo (visibili come blur con Lock icon).
 * Nomi interni dal SCENARIOS array in lib/pro/margin-math.
 */
const LOCKED_SCENARIOS = new Set<string>(["ttf_spike", "recessione_domanda"]);

const EUR_INT = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const NUM_1DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatPctSigned(decimal: number): string {
  const pct = decimal * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${NUM_1DP.format(pct)}%`;
}

function formatEurSigned(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${NUM_1DP.format(value)} €/MWh`;
}

export function ScenarioStress({
  rows,
  baseMargineAnno,
  whatIfShocks,
  onWhatIfChange,
  whatIfKpi,
}: {
  rows: { scenario: ScenarioModifier; kpi: KpiResult }[];
  baseMargineAnno: number;
  whatIfShocks: WhatIfShocks;
  onWhatIfChange: (shocks: WhatIfShocks) => void;
  whatIfKpi: KpiResult;
}) {
  const whatIfDelta = whatIfKpi.margineAnnoEur - baseMargineAnno;
  const whatIfDeltaClass =
    Math.abs(whatIfDelta) < 0.5
      ? "text-stone-500"
      : whatIfDelta >= 0
        ? "text-emerald-700"
        : "text-rose-600";

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <h3 className="font-semibold text-stone-900 flex items-center">
        Scenario stress
        <InfoTooltip
          label="Scenari stress"
          text="Come cambia il margine se il mercato si muove. Inverno freddo aumenta i consumi (volume +10%). TTF +20% aumenta il costo gas (+8 EUR/MWh): in contratti variabili passa al cliente, in contratti fissi te lo mangi. Recessione domanda riduce i volumi (-5%)."
        />
      </h3>
      <ul className="space-y-2 text-sm">
        {rows.map((r) => {
          const delta = r.kpi.margineAnnoEur - baseMargineAnno;
          const isBase = r.scenario.name === "base";
          const isLocked = LOCKED_SCENARIOS.has(r.scenario.name);
          const valueClass = isBase
            ? "text-stone-900"
            : delta >= 0
              ? "text-emerald-700"
              : "text-rose-600";
          if (isLocked) {
            return (
              <li
                key={r.scenario.name}
                className="flex items-baseline justify-between gap-3 opacity-60"
                title="Scenario disponibile su tier Pro 499€/mese"
              >
                <span className="text-stone-500 inline-flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-amber-600" aria-hidden />
                  {r.scenario.label}
                </span>
                <span className="text-xs font-bold text-amber-700">Pro 499€</span>
              </li>
            );
          }
          return (
            <li
              key={r.scenario.name}
              className="flex items-baseline justify-between gap-3"
            >
              <span
                className={
                  isBase
                    ? "text-stone-700 font-medium"
                    : "text-stone-600"
                }
              >
                {r.scenario.label}
              </span>
              <span className={`tabular-nums font-medium ${valueClass}`}>
                {EUR_INT.format(r.kpi.margineAnnoEur)}
                {!isBase && (
                  <span className="text-xs ml-1 text-stone-500">
                    ({delta >= 0 ? "+" : ""}
                    {EUR_INT.format(delta)})
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="pt-4 mt-2 border-t border-stone-200 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-stone-900">
            What-if custom
          </h4>
          <button
            type="button"
            onClick={() => onWhatIfChange(NO_SHOCKS)}
            className="text-xs text-stone-500 hover:text-stone-800 underline"
          >
            Reset
          </button>
        </div>

        <WhatIfSlider
          label="Shock volume"
          min={-0.2}
          max={0.2}
          step={0.01}
          value={whatIfShocks.volumeShockPct}
          format={formatPctSigned}
          onChange={(v) => onWhatIfChange({ ...whatIfShocks, volumeShockPct: v })}
          minLabel="-20%"
          maxLabel="+20%"
        />

        <WhatIfSlider
          label="Shock costo"
          min={-10}
          max={20}
          step={0.5}
          value={whatIfShocks.costShockEurPerMwh}
          format={formatEurSigned}
          onChange={(v) =>
            onWhatIfChange({ ...whatIfShocks, costShockEurPerMwh: v })
          }
          minLabel="-10"
          maxLabel="+20 €/MWh"
        />

        {/* Shock churn lockato in demo — slider visibile ma disabilitato */}
        <div className="opacity-50 cursor-not-allowed" title="What-if churn disponibile su tier Pro 499€/mese">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-amber-600" aria-hidden />
              Shock churn
            </span>
            <span className="text-[10px] font-bold uppercase text-amber-700">Pro 499€</span>
          </div>
          <input
            type="range"
            min={-0.1}
            max={0.1}
            step={0.005}
            value={0}
            disabled
            aria-label="Shock churn (locked)"
            className="w-full mt-2 accent-stone-400"
          />
          <div className="flex justify-between text-[10px] text-stone-400 tabular-nums">
            <span>-10 pp</span>
            <span>+10 pp</span>
          </div>
        </div>

        <div className="pt-2 text-sm flex items-baseline justify-between gap-3">
          <span className="text-stone-600">
            Margine sotto questi shock:
          </span>
          <span className="tabular-nums font-semibold text-stone-900">
            {EUR_INT.format(whatIfKpi.margineAnnoEur)}
            <span className={`text-xs ml-1 ${whatIfDeltaClass}`}>
              (Δ vs base {whatIfDelta >= 0 ? "+" : ""}
              {EUR_INT.format(whatIfDelta)})
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function WhatIfSlider({
  label,
  min,
  max,
  step,
  value,
  format,
  onChange,
  minLabel,
  maxLabel,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  minLabel: string;
  maxLabel: string;
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
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
