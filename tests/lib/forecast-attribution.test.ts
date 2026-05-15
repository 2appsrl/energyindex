/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { computeAttribution, type AttributionInput } from "@/lib/forecast/attribution";

describe("computeAttribution", () => {
  it("top 3 driver per |contribution|, segno corretto", () => {
    const input: AttributionInput = {
      featureNames: ["lag_1_target", "ttf_lag_1", "hdd_lag1", "is_holiday"],
      coefficients: [0.5, 0.3, 1.2, -2],
      featureRow: [150, 30, 10, 0],
      featureMeansTraining: [140, 32, 5, 0],
    };
    const drivers = computeAttribution(input, 3);
    expect(drivers).toHaveLength(3);
    // hdd_lag1: 1.2 * (10-5) = 6 (top)
    expect(drivers[0].name).toBe("hdd_lag1");
    expect(drivers[0].contribution).toBeCloseTo(6, 4);
    expect(drivers[0].direction).toBe("up");
  });

  it("rinomina feature tecniche in label user-facing", () => {
    const drivers = computeAttribution({
      featureNames: ["lag_1_target", "ttf_lag_1"],
      coefficients: [0.5, 0.3],
      featureRow: [150, 35],
      featureMeansTraining: [100, 30],
    }, 2);
    // Verifica che label sia leggibile (non tecnico)
    expect(drivers[0].label).toMatch(/PUN|Target|Storico|Lag/i);
  });
});
