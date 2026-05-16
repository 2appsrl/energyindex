"use client";

import { useMemo, useState } from "react";
import {
  computeKpi,
  applyScenario,
  computeBenchmarkVerdict,
  SCENARIOS,
  type SimulatorInputs,
  type ForecastBand,
} from "@/lib/pro/margin-math";
import type { ForecastChartPoint } from "@/components/forecast/ForecastChart";
import { SimulatorInputsPanel } from "./SimulatorInputsPanel";
import { KpiCards } from "./KpiCards";
import { ScenarioStress } from "./ScenarioStress";
import { CompetitorBenchmark } from "./CompetitorBenchmark";
import { SimulatorChart } from "./SimulatorChart";
import { SimulatorActions } from "./SimulatorActions";

interface CompetitorData {
  medianEurPerMwh: number;
  p25EurPerMwh: number;
  p75EurPerMwh: number;
  nOfferte: number;
}

const DEFAULT_INPUTS: SimulatorInputs = {
  volumeKwhPerYear: 250_000,
  contractMonths: 12,
  spreadEurPerMwh: 8.5,
  cacEur: 120,
  churnAnnualPct: 0.14,
  approvOverheadEurPerMwh: 3,
  contractType: "variabile",
};

export function MarginSimulator({
  forecastPoints,
  forecastAvgEurPerMwh,
  competitor,
}: {
  forecastPoints: ForecastChartPoint[];
  forecastAvgEurPerMwh: number;
  competitor: CompetitorData;
}) {
  const [inputs, setInputs] = useState<SimulatorInputs>(DEFAULT_INPUTS);

  const forecastBand: ForecastBand = useMemo(() => {
    // Fase 1: una sola media per tutte le durate contratto. Fase 2 (TODO):
    // slice del forecast in base ai mesi effettivi.
    const fpFc = forecastPoints.filter((p) => p.source === "forecast");
    const hasLower = fpFc.length > 0 && fpFc[0].value_lower !== null;
    const hasUpper = fpFc.length > 0 && fpFc[0].value_upper !== null;
    const avgLower = hasLower
      ? fpFc.reduce((s, p) => s + (p.value_lower ?? p.value), 0) / fpFc.length
      : forecastAvgEurPerMwh * 0.85;
    const avgUpper = hasUpper
      ? fpFc.reduce((s, p) => s + (p.value_upper ?? p.value), 0) / fpFc.length
      : forecastAvgEurPerMwh * 1.15;
    return {
      averageEurPerMwh: forecastAvgEurPerMwh,
      lowerEurPerMwh: avgLower,
      upperEurPerMwh: avgUpper,
    };
  }, [forecastPoints, forecastAvgEurPerMwh]);

  const kpi = useMemo(
    () => computeKpi(inputs, forecastBand),
    [inputs, forecastBand],
  );

  const scenarioRows = useMemo(
    () =>
      SCENARIOS.map((s) => ({
        scenario: s,
        kpi: applyScenario(inputs, forecastBand, s),
      })),
    [inputs, forecastBand],
  );

  const verdict = useMemo(
    () =>
      computeBenchmarkVerdict({
        yourSpreadEurPerMwh: inputs.spreadEurPerMwh,
        marketMedianEurPerMwh: competitor.medianEurPerMwh,
        marketP25EurPerMwh: competitor.p25EurPerMwh,
        marketP75EurPerMwh: competitor.p75EurPerMwh,
      }),
    [inputs.spreadEurPerMwh, competitor],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <SimulatorInputsPanel inputs={inputs} onChange={setInputs} />
      <div className="space-y-6 min-w-0">
        <KpiCards kpi={kpi} />
        <SimulatorChart
          points={forecastPoints}
          contractMonths={inputs.contractMonths}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <ScenarioStress
            rows={scenarioRows}
            baseMargineAnno={kpi.margineAnnoEur}
          />
          <CompetitorBenchmark
            yourSpread={inputs.spreadEurPerMwh}
            competitor={competitor}
            verdict={verdict}
          />
        </div>
        <SimulatorActions />
      </div>
    </div>
  );
}
