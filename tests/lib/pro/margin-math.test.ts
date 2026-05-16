import { describe, it, expect } from "vitest";
import {
  computeKpi,
  applyScenario,
  computeBenchmarkVerdict,
  SCENARIOS,
  type SimulatorInputs,
  type ForecastBand,
  type CompetitorBenchmark,
} from "@/lib/pro/margin-math";

const baseInputs: SimulatorInputs = {
  volumeKwhPerYear: 250_000,
  contractMonths: 12,
  spreadEurPerMwh: 8.5,
  cacEur: 120,
  churnAnnualPct: 0.14,
  contractType: "variabile",
};

const baseForecast: ForecastBand = {
  averageEurPerMwh: 100,
  lowerEurPerMwh: 90,
  upperEurPerMwh: 115,
};

describe("computeKpi", () => {
  it("base case: 250k kWh @ spread 8.5 -> margine 2125, contract_value 27.625, LTV positive", () => {
    const kpi = computeKpi(baseInputs, baseForecast);

    // costo = 100 + 3 (default overhead) = 103
    expect(kpi.costoApprovvigionamentoEurPerMwh).toBeCloseTo(103, 5);
    // prezzo = 103 + 8.5 = 111.5
    expect(kpi.prezzoVenditaEurPerMwh).toBeCloseTo(111.5, 5);
    // volumeMwh = 250, margine = 8.5 * 250 = 2125
    expect(kpi.margineAnnoEur).toBeCloseTo(2125, 5);
    // contract value = 111.5 * 250 * 1 = 27875
    // (NB: con years=1 il contract value = prezzo * volumeMwh)
    expect(kpi.contractValueEur).toBeCloseTo(27875, 5);
    // LTV >= margine - CAC (con 1 anno e churn 14%, sum ~= 0.926, ltv_gross ~= 1968.6, − 120)
    expect(kpi.ltvContrattoEur).toBeGreaterThan(0);
    expect(kpi.ltvContrattoEur).toBeLessThan(kpi.margineAnnoEur);
  });

  it("zero churn: ltv = margine * years - CAC", () => {
    const inputs: SimulatorInputs = { ...baseInputs, churnAnnualPct: 0, contractMonths: 24 };
    const kpi = computeKpi(inputs, baseForecast);
    // margine annuo invariato = 2125
    expect(kpi.margineAnnoEur).toBeCloseTo(2125, 5);
    // years = 2 -> ltv_gross = 2125 * 2 = 4250; ltv = 4250 - 120 = 4130
    expect(kpi.ltvContrattoEur).toBeCloseTo(4130, 5);
  });
});

describe("applyScenario", () => {
  const scenarioByName = (name: string) => {
    const s = SCENARIOS.find((sc) => sc.name === name);
    if (!s) throw new Error(`scenario not found: ${name}`);
    return s;
  };

  it("inverno_freddo: margine aumenta del 10% (volumeMultiplier 1.10)", () => {
    const baseKpi = computeKpi(baseInputs, baseForecast);
    const stressed = applyScenario(baseInputs, baseForecast, scenarioByName("inverno_freddo"));
    expect(stressed.margineAnnoEur).toBeCloseTo(baseKpi.margineAnnoEur * 1.1, 5);
  });

  it("ttf_spike: margine invariato (PUN passthrough)", () => {
    const baseKpi = computeKpi(baseInputs, baseForecast);
    const stressed = applyScenario(baseInputs, baseForecast, scenarioByName("ttf_spike"));
    expect(stressed.margineAnnoEur).toBeCloseTo(baseKpi.margineAnnoEur, 5);
    // ma il costo approvv. sale di 8
    expect(stressed.costoApprovvigionamentoEurPerMwh).toBeCloseTo(
      baseKpi.costoApprovvigionamentoEurPerMwh + 8,
      5,
    );
  });

  it("recessione_domanda: margine cala del 5%", () => {
    const baseKpi = computeKpi(baseInputs, baseForecast);
    const stressed = applyScenario(baseInputs, baseForecast, scenarioByName("recessione_domanda"));
    expect(stressed.margineAnnoEur).toBeCloseTo(baseKpi.margineAnnoEur * 0.95, 5);
  });

  it("FISSO mode: TTF spike eats into margine (cost shock reduces effective spread)", () => {
    const inputsFisso: SimulatorInputs = {
      volumeKwhPerYear: 250_000,
      contractMonths: 12,
      spreadEurPerMwh: 8.5,
      cacEur: 120,
      churnAnnualPct: 0.14,
      contractType: "fisso",
    };
    const forecast: ForecastBand = {
      averageEurPerMwh: 100,
      lowerEurPerMwh: 85,
      upperEurPerMwh: 115,
    };
    const ttfSpike = SCENARIOS.find((s) => s.name === "ttf_spike")!;
    const result = applyScenario(inputsFisso, forecast, ttfSpike);
    // margine = (8.5 - 8) * 250 = 0.5 * 250 = 125
    expect(result.margineAnnoEur).toBeCloseTo(125, 1);
  });

  it("VARIABILE mode: TTF spike does NOT change margine (passthrough)", () => {
    const inputsVar: SimulatorInputs = {
      volumeKwhPerYear: 250_000,
      contractMonths: 12,
      spreadEurPerMwh: 8.5,
      cacEur: 120,
      churnAnnualPct: 0.14,
      contractType: "variabile",
    };
    const forecast: ForecastBand = {
      averageEurPerMwh: 100,
      lowerEurPerMwh: 85,
      upperEurPerMwh: 115,
    };
    const ttfSpike = SCENARIOS.find((s) => s.name === "ttf_spike")!;
    const result = applyScenario(inputsVar, forecast, ttfSpike);
    // margine = 8.5 * 250 = 2125 (unchanged)
    expect(result.margineAnnoEur).toBeCloseTo(2125, 1);
  });

  it("BOTH modes: inverno freddo (volume +10%) grows margine proportionally", () => {
    const inputs: SimulatorInputs = {
      volumeKwhPerYear: 250_000,
      contractMonths: 12,
      spreadEurPerMwh: 8.5,
      cacEur: 120,
      churnAnnualPct: 0.14,
      contractType: "variabile",
    };
    const forecast: ForecastBand = {
      averageEurPerMwh: 100,
      lowerEurPerMwh: 85,
      upperEurPerMwh: 115,
    };
    const cold = SCENARIOS.find((s) => s.name === "inverno_freddo")!;
    const resultVar = applyScenario(inputs, forecast, cold);
    const resultFis = applyScenario({ ...inputs, contractType: "fisso" }, forecast, cold);
    // Both modes: 8.5 * (250 * 1.1) = 8.5 * 275 = 2337.5
    expect(resultVar.margineAnnoEur).toBeCloseTo(2337.5, 1);
    expect(resultFis.margineAnnoEur).toBeCloseTo(2337.5, 1);
  });
});

describe("computeBenchmarkVerdict", () => {
  it("sotto mediano: delta < -10% -> percentile 25, label 'Sotto mediano'", () => {
    const b: CompetitorBenchmark = {
      yourSpreadEurPerMwh: 5,
      marketMedianEurPerMwh: 10,
      marketP25EurPerMwh: 7,
      marketP75EurPerMwh: 13,
    };
    const v = computeBenchmarkVerdict(b);
    expect(v.positionPercentile).toBe(25);
    expect(v.label).toMatch(/Sotto mediano/i);
    expect(v.label).toMatch(/50/); // (5-10)/10*100 = -50%
  });

  it("allineato: delta in [-10%, +10%] -> percentile 50", () => {
    const b: CompetitorBenchmark = {
      yourSpreadEurPerMwh: 10.5,
      marketMedianEurPerMwh: 10,
      marketP25EurPerMwh: 7,
      marketP75EurPerMwh: 13,
    };
    const v = computeBenchmarkVerdict(b);
    expect(v.positionPercentile).toBe(50);
    expect(v.label).toMatch(/Allineato/i);
  });

  it("sopra mediano: delta > +10% -> percentile 75, label 'Sopra mediano'", () => {
    const b: CompetitorBenchmark = {
      yourSpreadEurPerMwh: 15,
      marketMedianEurPerMwh: 10,
      marketP25EurPerMwh: 7,
      marketP75EurPerMwh: 13,
    };
    const v = computeBenchmarkVerdict(b);
    expect(v.positionPercentile).toBe(75);
    expect(v.label).toMatch(/Sopra mediano/i);
    expect(v.label).toMatch(/50/); // (15-10)/10*100 = +50%
  });
});
