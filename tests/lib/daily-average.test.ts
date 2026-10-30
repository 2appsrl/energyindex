/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { dailyAveragesRome } from "@/lib/prices/daily-average";

describe("dailyAveragesRome", () => {
  it("raggruppa le ore per giorno italiano, non per giorno UTC", () => {
    const rows = [
      { observed_at: "2026-10-29T22:00:00Z", value: 100 }, // 29/10 ore 23 CET
      { observed_at: "2026-10-29T23:00:00Z", value: 200 }, // 30/10 ore 00 CET
      { observed_at: "2026-10-30T10:00:00Z", value: 300 }, // 30/10
    ];
    const avg = dailyAveragesRome(rows);
    expect(avg.get("2026-10-29")).toEqual({ value: 100, hours: 1 });
    expect(avg.get("2026-10-30")).toEqual({ value: 250, hours: 2 });
  });

  it("accetta valori numerici come stringa (risposta PostgREST numeric)", () => {
    const avg = dailyAveragesRome([{ observed_at: "2026-10-30T10:00:00Z", value: "274.04" }]);
    expect(avg.get("2026-10-30")?.value).toBeCloseTo(274.04);
  });

  it("ignora valori non numerici", () => {
    const avg = dailyAveragesRome([
      { observed_at: "2026-10-30T10:00:00Z", value: 10 },
      { observed_at: "2026-10-30T11:00:00Z", value: null },
    ]);
    expect(avg.get("2026-10-30")).toEqual({ value: 10, hours: 1 });
  });
});
