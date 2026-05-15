/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { generateForecastForAsset, MODEL_VERSION, type ForecastInput } from "@/lib/forecast/orchestrator";
import type { SeriesPoint } from "@/lib/forecast/features";

function makeSeries(days: number, base: number): SeriesPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(2024, 0, 1));
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d, value: base + Math.sin(i / 10) * 5 + i * 0.05 };
  });
}

describe("generateForecastForAsset", () => {
  it("ritorna struct completo con value, banda, drivers", () => {
    const input: ForecastInput = {
      assetSlug: "pun",
      horizonDays: 7,
      target: makeSeries(500, 120),
      drivers: {
        ttf: makeSeries(500, 30),
        brent: makeSeries(500, 80),
        co2: makeSeries(500, 70),
        temperature: makeSeries(500, 15),
      },
      generatedAt: new Date("2026-05-14T05:00:00Z"),
    };
    const out = generateForecastForAsset(input);
    expect(out).not.toBeNull();
    expect(out!.value).toBeGreaterThan(0);
    expect(out!.value_lower).toBeLessThanOrEqual(out!.value);
    expect(out!.value_upper).toBeGreaterThanOrEqual(out!.value);
    expect(out!.drivers).toBeInstanceOf(Array);
    expect(out!.model_version).toBe(MODEL_VERSION);
    expect(out!.horizon_days).toBe(7);
    // forecast_date = generatedAt + horizonDays = 2026-05-14 + 7 = 2026-05-21
    expect(out!.forecast_date).toBe("2026-05-21");
  });

  it("ritorna null se non ci sono abbastanza dati storici", () => {
    const out = generateForecastForAsset({
      assetSlug: "pun",
      horizonDays: 90,
      target: makeSeries(30, 100),  // troppo corto
      drivers: {
        ttf: makeSeries(30, 30),
        brent: makeSeries(30, 80),
        co2: makeSeries(30, 70),
        temperature: makeSeries(30, 15),
      },
      generatedAt: new Date("2026-05-14T05:00:00Z"),
    });
    expect(out).toBeNull();
  });
});
