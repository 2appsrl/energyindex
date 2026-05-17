"use client";

import { useMemo, useState } from "react";
import {
  computeKpi,
  applyScenario,
  applyWhatIf,
  computeBenchmarkVerdict,
  NO_SHOCKS,
  SCENARIOS,
  type SimulatorInputs,
  type ForecastBand,
  type WhatIfShocks,
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
  source: string;
}

const DEFAULT_INPUTS: SimulatorInputs = {
  volumeKwhPerYear: 250_000,
  contractMonths: 12,
  spreadEurPerMwh: 8.5,
  fixedPriceEurPerMwh: 130, // ~ PUN recente + markup tipico
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
  const [whatIfShocks, setWhatIfShocks] = useState<WhatIfShocks>(NO_SHOCKS);

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

  const whatIfKpi = useMemo(
    () => applyWhatIf(inputs, forecastBand, whatIfShocks),
    [inputs, forecastBand, whatIfShocks],
  );

  // Spread "effettivo" mostrato nel benchmark:
  //  - variabile: e' direttamente l'input dell'utente (slider Spread vendita)
  //  - fisso: lo spread NON e' input; e' derivato come (prezzo_fisso − costo_approv).
  //    Es. prezzo 147 EUR/MWh con costo 113 -> derived spread 34 EUR/MWh.
  // Senza questa logica la card mostrava sempre lo slider variabile (8.5) anche
  // dopo aver switchato a Fisso e cambiato il prezzo, dando un verdict sbagliato.
  const effectiveSpreadEurPerMwh = inputs.contractType === "fisso"
    ? inputs.fixedPriceEurPerMwh - kpi.costoApprovvigionamentoEurPerMwh
    : inputs.spreadEurPerMwh;

  const verdict = useMemo(
    () =>
      computeBenchmarkVerdict({
        yourSpreadEurPerMwh: effectiveSpreadEurPerMwh,
        marketMedianEurPerMwh: competitor.medianEurPerMwh,
        marketP25EurPerMwh: competitor.p25EurPerMwh,
        marketP75EurPerMwh: competitor.p75EurPerMwh,
      }),
    [effectiveSpreadEurPerMwh, competitor],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <SimulatorInputsPanel inputs={inputs} onChange={setInputs} />
      <div className="space-y-6 min-w-0">
        <div data-tour="kpi">
          <KpiCards kpi={kpi} />
        </div>
        <div data-tour="chart">
          <SimulatorChart
            points={forecastPoints}
            contractMonths={inputs.contractMonths}
          />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div data-tour="scenarios">
            <ScenarioStress
              rows={scenarioRows}
              baseMargineAnno={kpi.margineAnnoEur}
              whatIfShocks={whatIfShocks}
              onWhatIfChange={setWhatIfShocks}
              whatIfKpi={whatIfKpi}
            />
          </div>
          <div data-tour="competitor">
            <CompetitorBenchmark
              yourSpread={effectiveSpreadEurPerMwh}
              competitor={competitor}
              verdict={verdict}
            />
          </div>
        </div>
        <div data-tour="actions">
          <SimulatorActions />
        </div>
      </div>
    </div>
  );
}
