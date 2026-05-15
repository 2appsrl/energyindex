/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { sanitizeSeries } from "@/scripts/run-forecast-daily";

describe("sanitizeSeries", () => {
  it("ordina cronologicamente e rimuove duplicati per data UTC", () => {
    const out = sanitizeSeries([
      { observed_at: "2026-05-02T12:00:00Z", value: 100 },
      { observed_at: "2026-05-01T12:00:00Z", value: 90 },
      { observed_at: "2026-05-02T12:00:00Z", value: 101 }, // dup
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].value).toBe(90);
    expect(out[1].value).toBe(100.5); // media tra 100 e 101
  });

  it("normalizza a mezzogiorno UTC (per allineare PUN orario su daily)", () => {
    const out = sanitizeSeries([
      { observed_at: "2026-05-01T08:00:00Z", value: 100 },
      { observed_at: "2026-05-01T20:00:00Z", value: 110 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(105);
    expect(out[0].date.toISOString().endsWith("T12:00:00.000Z")).toBe(true);
  });
});
