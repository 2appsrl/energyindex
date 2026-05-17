"use client";

import { useMemo, useState } from "react";
import { ForecastChart } from "@/components/forecast/ForecastChart";
import {
  applyScenarioToForecast,
  computePunMultiplier,
  NO_SCENARIO_SHOCKS,
  type ForecastPoint,
  type ScenarioInputs,
} from "@/lib/pro/forecast-scenari-math";

const PCT = new Intl.NumberFormat("it-IT", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function ForecastScenariView({ baseline }: { baseline: ForecastPoint[] }) {
  const [shocks, setShocks] = useState<ScenarioInputs>(NO_SCENARIO_SHOCKS);

  const scenarioPoints = useMemo(() => applyScenarioToForecast(baseline, shocks), [baseline, shocks]);
  const multiplier = useMemo(() => computePunMultiplier(shocks), [shocks]);
  const pctChange = multiplier - 1;

  // forecast medio baseline vs scenario
  const baselineAvg = useMemo(() => {
    const fp = baseline.filter((p) => p.source === "forecast");
    return fp.length > 0 ? fp.reduce((s, p) => s + p.value, 0) / fp.length : 0;
  }, [baseline]);
  const scenarioAvg = baselineAvg * multiplier;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* INPUT */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-5 h-fit">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Shock driver</h2>

        <ScenarioSlider
          label="TTF gas Europa"
          value={shocks.ttfShockPct}
          min={-30}
          max={50}
          step={5}
          unit="%"
          onChange={(v) => setShocks({ ...shocks, ttfShockPct: v })}
        />
        <ScenarioSlider
          label="Brent petrolio"
          value={shocks.brentShockPct}
          min={-30}
          max={50}
          step={5}
          unit="%"
          onChange={(v) => setShocks({ ...shocks, brentShockPct: v })}
        />
        <ScenarioSlider
          label="CO2 EU ETS"
          value={shocks.co2ShockPct}
          min={-30}
          max={50}
          step={5}
          unit="%"
          onChange={(v) => setShocks({ ...shocks, co2ShockPct: v })}
        />
        <ScenarioSlider
          label="Anomalia temperatura"
          value={shocks.tempAnomalyC}
          min={-5}
          max={5}
          step={0.5}
          unit="°C"
          onChange={(v) => setShocks({ ...shocks, tempAnomalyC: v })}
        />

        <button
          type="button"
          onClick={() => setShocks(NO_SCENARIO_SHOCKS)}
          className="text-xs text-stone-500 underline"
        >
          Reset scenario
        </button>

        <div className="pt-3 border-t border-stone-200 text-xs text-stone-500">
          Sensitivity stimate dal modello Ridge: TTF dominante (0.5x), Brent (0.2x), CO2 (0.1x), temperatura -1&deg;C → +2% PUN.
        </div>
      </div>

      {/* OUTPUT */}
      <div className="space-y-6 min-w-0">
        {/* Impact summary */}
        <div className={`rounded-xl border p-5 ${
          Math.abs(pctChange) < 0.005
            ? "bg-stone-50 border-stone-200"
            : pctChange > 0
              ? "bg-rose-50 border-rose-200"
              : "bg-emerald-50 border-emerald-200"
        }`}>
          <div className="flex items-baseline justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-stone-500">Impatto PUN scenario</div>
              <div className={`text-3xl font-bold tabular-nums ${
                Math.abs(pctChange) < 0.005
                  ? "text-stone-700"
                  : pctChange > 0
                    ? "text-rose-700"
                    : "text-emerald-700"
              }`}>
                {pctChange >= 0 ? "+" : ""}{PCT.format(pctChange)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-stone-500">PUN forecast medio</div>
              <div className="text-sm tabular-nums">
                Baseline: <span className="font-mono">{baselineAvg.toFixed(2)} €/MWh</span>
              </div>
              <div className="text-sm tabular-nums font-semibold">
                Scenario: <span className="font-mono">{scenarioAvg.toFixed(2)} €/MWh</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold">Forecast PUN sotto scenario</h3>
            <span className="text-xs text-stone-500">€/MWh · banda 5–95% (allarga con shock estremi)</span>
          </div>
          <ForecastChart points={scenarioPoints} unit="€/MWh" forceTheme="light" />
        </div>
      </div>
    </div>
  );
}

function ScenarioSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const display = value === 0 ? "—" : `${value > 0 ? "+" : ""}${value}${unit}`;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-stone-700">{label}</label>
        <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
          value === 0
            ? "bg-stone-100 text-stone-500"
            : "bg-emerald-100 text-emerald-900"
        }`}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-700"
      />
      <div className="flex justify-between text-xs text-stone-500">
        <span>{min}{unit}</span>
        <span>0</span>
        <span>+{max}{unit}</span>
      </div>
    </div>
  );
}
