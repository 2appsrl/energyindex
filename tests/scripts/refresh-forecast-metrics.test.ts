/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { computeMetrics, type ForecastVsReal } from "@/scripts/refresh-forecast-metrics";

describe("computeMetrics", () => {
  it("MAPE / RMSE / hit_ratio / coverage su esempio sintetico", () => {
    const pairs: ForecastVsReal[] = [
      { real: 100, predicted: 105, lower: 95, upper: 115, prev_real: 90 },
      { real: 110, predicted: 108, lower: 100, upper: 120, prev_real: 100 },
      { real: 95,  predicted: 100, lower: 90, upper: 110, prev_real: 100 },
    ];
    const m = computeMetrics(pairs);
    expect(m.mape).toBeCloseTo(((5/100 + 2/110 + 5/95) / 3) * 100, 2);
    expect(m.rmse).toBeCloseTo(Math.sqrt((25 + 4 + 25)/3), 2);
    expect(m.coverage).toBeCloseTo(1, 5);
    // hit_ratio:
    // pair1: pred 105>90 (up) vs real 100>90 (up) -> match
    // pair2: pred 108>100 (up) vs real 110>100 (up) -> match
    // pair3: pred 100==100 (predicted==prev_real, NOT up per implementation) vs real 95<100 (down) -> match
    // Actually need to verify what the impl considers a hit. Use the criterion:
    //   predUp = predicted >= prev_real ; realUp = real >= prev_real ; predicted != prev_real (no flat)
    // pair3: predicted == prev_real → no hit counted (excluded by predicted != prev_real)
    // So hit_ratio = 2/3
    expect(m.hit_ratio).toBeCloseTo(2/3, 4);
    expect(m.n_observations).toBe(3);
  });

  it("ritorna null metrics se nessuna coppia", () => {
    const m = computeMetrics([]);
    expect(m.mape).toBeNull();
    expect(m.n_observations).toBe(0);
  });
});
