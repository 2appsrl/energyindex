/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { trainRidge, predictRidge, conformalQuantile, type RidgeModel } from "@/lib/forecast/model";

describe("trainRidge", () => {
  it("ricostruisce y = 2*x1 + 3*x2 + 5 (problema esatto, lambda piccolo)", () => {
    const X = [
      [1, 1], [1, 2], [2, 1], [2, 2], [3, 1], [3, 2], [1, 3], [3, 3],
    ];
    const y = X.map(([a, b]) => 2 * a + 3 * b + 5);
    const m = trainRidge(X, y, 0.01);
    expect(m.coefficients).toHaveLength(2);
    expect(m.coefficients[0]).toBeCloseTo(2, 0);
    expect(m.coefficients[1]).toBeCloseTo(3, 0);
    expect(m.intercept).toBeCloseTo(5, 0);
  });

  it("lambda elevato shrinka i coefficient verso 0", () => {
    const X = [[1, 1], [2, 2], [3, 3], [4, 4]];
    const y = [10, 20, 30, 40];
    const small = trainRidge(X, y, 0.01);
    const large = trainRidge(X, y, 100);
    const normSmall = Math.hypot(...small.coefficients);
    const normLarge = Math.hypot(...large.coefficients);
    expect(normLarge).toBeLessThan(normSmall);
  });
});

describe("predictRidge", () => {
  it("ritorna y_hat = X·beta + intercept", () => {
    const model: RidgeModel = {
      coefficients: [2, 3],
      intercept: 5,
      featureMeans: [0, 0],
      featureStds: [1, 1],
      lambda: 0.01,
    };
    expect(predictRidge(model, [1, 1])).toBe(2 + 3 + 5);
    expect(predictRidge(model, [2, 3])).toBe(4 + 9 + 5);
  });
});

describe("conformalQuantile", () => {
  it("0.9 quantile di residui assoluti = 9 su 10 valori sotto la soglia", () => {
    const residuals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const q = conformalQuantile(residuals, 0.9);
    expect(q).toBeGreaterThanOrEqual(9);
  });
  it("gestisce array vuoto ritornando 0", () => {
    expect(conformalQuantile([], 0.9)).toBe(0);
  });
});
