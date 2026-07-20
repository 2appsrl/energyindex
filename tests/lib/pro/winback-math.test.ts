/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { computeWinback, type WinbackInputs } from "@/lib/pro/winback-math";

function makeInputs(overrides: Partial<WinbackInputs> = {}): WinbackInputs {
  return {
    segment: "pmi",
    previousPriceEurPerMwh: 140,
    annualKwh: 250_000,
    monthsSinceLost: 3,
    competitorPriceEurPerMwh: 130,
    ...overrides,
  };
}

describe("computeWinback", () => {
  it("ritorna sempre 3 offerte", () => {
    const r = computeWinback(makeInputs());
    expect(r.offers).toHaveLength(3);
  });

  it("solo la prima offerta e' unlocked (le altre 2 locked)", () => {
    const r = computeWinback(makeInputs());
    expect(r.offers[0].locked).toBe(false);
    expect(r.offers[1].locked).toBe(true);
    expect(r.offers[2].locked).toBe(true);
  });

  it("offerte ordinate per ROI decrescente", () => {
    const r = computeWinback(makeInputs());
    for (let i = 1; i < r.offers.length; i++) {
      // Tutte finite tranne edge case
      if (Number.isFinite(r.offers[i - 1].roi) && Number.isFinite(r.offers[i].roi)) {
        expect(r.offers[i - 1].roi).toBeGreaterThanOrEqual(r.offers[i].roi);
      }
    }
  });

  it("acceptance probability nel range [0, 1]", () => {
    const r = computeWinback(makeInputs());
    for (const o of r.offers) {
      expect(o.acceptanceProb).toBeGreaterThanOrEqual(0);
      expect(o.acceptanceProb).toBeLessThanOrEqual(1);
    }
  });

  it("notWinnableProb e' complementare al max acceptance", () => {
    const r = computeWinback(makeInputs());
    const maxAcc = Math.max(...r.offers.map((o) => o.acceptanceProb));
    expect(r.notWinnableProb).toBeCloseTo(1 - maxAcc, 5);
  });

  it("piu' tempo dalla perdita = minor acceptance", () => {
    const recent = computeWinback(makeInputs({ monthsSinceLost: 1 }));
    const old = computeWinback(makeInputs({ monthsSinceLost: 18 }));
    const recentMax = Math.max(...recent.offers.map((o) => o.acceptanceProb));
    const oldMax = Math.max(...old.offers.map((o) => o.acceptanceProb));
    expect(recentMax).toBeGreaterThan(oldMax);
  });

  it("segmento domestico ha acceptance > industriale (a parita' di prezzo)", () => {
    const dom = computeWinback(makeInputs({ segment: "domestico" }));
    const ind = computeWinback(makeInputs({ segment: "industriale" }));
    const domMax = Math.max(...dom.offers.map((o) => o.acceptanceProb));
    const indMax = Math.max(...ind.offers.map((o) => o.acceptanceProb));
    expect(domMax).toBeGreaterThan(indMax);
  });

  it("payback months sempre >= 0 (o Infinity edge case)", () => {
    const r = computeWinback(makeInputs());
    for (const o of r.offers) {
      expect(o.paybackMonths >= 0 || !Number.isFinite(o.paybackMonths)).toBe(true);
    }
  });

  it("expectedNetLtvEur sempre >= 0 (offerta non puo' generare LTV negativo)", () => {
    const r = computeWinback(makeInputs());
    for (const o of r.offers) {
      expect(o.expectedNetLtvEur).toBeGreaterThanOrEqual(0);
    }
  });

  it("gestisce gracefully volume=0 (nessun cliente)", () => {
    const r = computeWinback(makeInputs({ annualKwh: 0 }));
    expect(r.offers).toHaveLength(3);
    expect(Number.isFinite(r.notWinnableProb)).toBe(true);
  });
});
