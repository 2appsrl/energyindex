/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { computePunMultiplier, applyScenarioToForecast, NO_SCENARIO_SHOCKS, type ForecastPoint } from "@/lib/pro/forecast-scenari-math";

describe("computePunMultiplier", () => {
  it("NO_SHOCKS ritorna 1.0", () => {
    expect(computePunMultiplier(NO_SCENARIO_SHOCKS)).toBe(1);
  });

  it("TTF +20% -> PUN +10% (sensitivity 0.5)", () => {
    const m = computePunMultiplier({ ...NO_SCENARIO_SHOCKS, ttfShockPct: 20 });
    expect(m).toBeCloseTo(1.10, 4);
  });

  it("Brent +10% -> PUN +2%", () => {
    const m = computePunMultiplier({ ...NO_SCENARIO_SHOCKS, brentShockPct: 10 });
    expect(m).toBeCloseTo(1.02, 4);
  });

  it("Temperatura -2C -> PUN +4%", () => {
    const m = computePunMultiplier({ ...NO_SCENARIO_SHOCKS, tempAnomalyC: -2 });
    expect(m).toBeCloseTo(1.04, 4);
  });

  it("shock combinati si sommano linearmente", () => {
    const m = computePunMultiplier({
      ttfShockPct: 20,        // +10%
      brentShockPct: 10,       // +2%
      co2ShockPct: 10,         // +1%
      tempAnomalyC: -1,        // +2%
    });
    expect(m).toBeCloseTo(1.15, 4);
  });
});

describe("applyScenarioToForecast", () => {
  const baseline: ForecastPoint[] = [
    { date: "2026-05-01", source: "history", value: 100, value_lower: null, value_upper: null },
    { date: "2026-06-01", source: "forecast", value: 110, value_lower: 100, value_upper: 120 },
    { date: "2026-07-01", source: "forecast", value: 115, value_lower: 105, value_upper: 125 },
  ];

  it("history non viene modificato", () => {
    const out = applyScenarioToForecast(baseline, { ...NO_SCENARIO_SHOCKS, ttfShockPct: 50 });
    expect(out[0]).toEqual(baseline[0]);
  });

  it("forecast viene scalato per il multiplier", () => {
    const out = applyScenarioToForecast(baseline, { ...NO_SCENARIO_SHOCKS, ttfShockPct: 20 });
    expect(out[1].value).toBeCloseTo(121, 1);
  });

  it("banda si allarga sotto shock estremo", () => {
    const out = applyScenarioToForecast(baseline, { ...NO_SCENARIO_SHOCKS, ttfShockPct: 50 });
    const originalBand = baseline[1].value_upper! - baseline[1].value_lower!;
    const newBand = out[1].value_upper! - out[1].value_lower!;
    expect(newBand).toBeGreaterThan(originalBand);
  });
});
