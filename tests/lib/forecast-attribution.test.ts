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

describe("computeAttribution — one-hot aggregation", () => {
  it("dow_* contributi: solo il dow attivo conta (no cancellazione)", () => {
    // Setup: Monday is active (dow_1 = 1, others = 0)
    // Training mean of each dow_i = 1/7 (perfect balance)
    // Coefficient on dow_1 = 10 (Monday pushes up); others = -1 each
    // Old behavior would sum: 10*(1-1/7) + 6*(-1)*(0-1/7) = 10*6/7 + 6/7 ≈ 9.43
    //   (but with sign cancellation in real data the aggregate ~0)
    // New behavior: only dow_1 active = 10*(1-1/7) = 60/7 ≈ 8.57
    const input: AttributionInput = {
      featureNames: ["dow_0", "dow_1", "dow_2", "dow_3", "dow_4", "dow_5", "dow_6"],
      coefficients: [-1, 10, -1, -1, -1, -1, -1],
      featureRow:  [0, 1, 0, 0, 0, 0, 0],
      featureMeansTraining: [1/7, 1/7, 1/7, 1/7, 1/7, 1/7, 1/7],
    };
    const out = computeAttribution(input, 5);
    // L'unica entry "calendar_dow" deve riflettere SOLO dow_1: 10*(1-1/7) ≈ 8.57
    expect(out).toHaveLength(1);  // tutti gli altri dow finiscono nello stesso group, no individual entry
    expect(out[0].label).toBe("Giorno della settimana");
    expect(out[0].contribution).toBeCloseTo(10 * (1 - 1/7), 2);
    expect(out[0].direction).toBe("up");
  });
});

describe("computeAttribution — direction down", () => {
  it("contributo negativo -> direction 'down'", () => {
    const input: AttributionInput = {
      featureNames: ["ttf_lag_1"],
      coefficients: [0.5],
      featureRow: [20],                  // sotto la media
      featureMeansTraining: [30],
    };
    const out = computeAttribution(input, 1);
    expect(out[0].direction).toBe("down");
    expect(out[0].contribution).toBeCloseTo(-5, 4);
  });
});

describe("computeAttribution — input dimension mismatches throw", () => {
  it("featureNames vs coefficients dim mismatch", () => {
    expect(() => computeAttribution({
      featureNames: ["a", "b"],
      coefficients: [1, 2, 3],
      featureRow: [10, 20, 30],
      featureMeansTraining: [5, 10, 15],
    }, 3)).toThrow(/featureNames.*coefficients/i);
  });
  it("featureRow vs coefficients dim mismatch", () => {
    expect(() => computeAttribution({
      featureNames: ["a", "b"],
      coefficients: [1, 2],
      featureRow: [10],
      featureMeansTraining: [5, 10],
    }, 2)).toThrow(/featureRow.*coefficients/i);
  });
});
