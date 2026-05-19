/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { predictChurn, type ChurnInputs } from "@/lib/pro/churn-math";

function makeInputs(overrides: Partial<ChurnInputs> = {}): ChurnInputs {
  return {
    segment: "domestico",
    annualKwh: 3500,
    offerType: "variabile",
    contractAgeMonths: 14,
    currentPriceEurPerMwh: 130,
    marketPunEurPerMwh: 110,
    ...overrides,
  };
}

describe("predictChurn", () => {
  it("ritorna probabilita' nel range [0, 0.95]", () => {
    const r = predictChurn(makeInputs());
    expect(r.probability).toBeGreaterThanOrEqual(0);
    expect(r.probability).toBeLessThanOrEqual(0.95);
  });

  it("gap prezzo alto aumenta la probabilita'", () => {
    const lowGap = predictChurn(makeInputs({ currentPriceEurPerMwh: 110 })); // 0% gap
    const highGap = predictChurn(makeInputs({ currentPriceEurPerMwh: 145 })); // ~32% gap
    expect(highGap.probability).toBeGreaterThan(lowGap.probability);
  });

  it("contratto in lock-in 0-12mo ha churn piu' bassa di 12-18mo", () => {
    const lockIn = predictChurn(makeInputs({ contractAgeMonths: 6 }));
    const fineLockIn = predictChurn(makeInputs({ contractAgeMonths: 14 }));
    expect(fineLockIn.probability).toBeGreaterThan(lockIn.probability);
  });

  it("offerta variabile leggermente piu' churn di fisso", () => {
    const fisso = predictChurn(makeInputs({ offerType: "fisso" }));
    const variabile = predictChurn(makeInputs({ offerType: "variabile" }));
    expect(variabile.probability).toBeGreaterThan(fisso.probability);
  });

  it("segmento industriale ha base churn piu' bassa di domestico", () => {
    const ind = predictChurn(
      makeInputs({ segment: "industriale", annualKwh: 500_000, contractAgeMonths: 24 }),
    );
    const dom = predictChurn(makeInputs({ contractAgeMonths: 24 }));
    expect(ind.probability).toBeLessThan(dom.probability);
  });

  it("ritorna sempre 3 azioni consigliate", () => {
    const r = predictChurn(makeInputs());
    expect(r.recommendedActions).toHaveLength(3);
  });

  it("solo 1 azione e' sbloccata nel demo (le altre 2 sono locked)", () => {
    const r = predictChurn(makeInputs());
    const unlocked = r.recommendedActions.filter((a) => !a.locked);
    const locked = r.recommendedActions.filter((a) => a.locked);
    expect(unlocked).toHaveLength(1);
    expect(locked).toHaveLength(2);
  });

  it("risk level segue le soglie", () => {
    // Caso low: cliente nuovo, prezzo sotto mercato
    const low = predictChurn(
      makeInputs({ contractAgeMonths: 3, currentPriceEurPerMwh: 100, marketPunEurPerMwh: 110 }),
    );
    expect(low.riskLevel).toBe("low");

    // Caso critical: prezzo molto sopra mercato + fine lock-in + variabile
    const critical = predictChurn(
      makeInputs({
        contractAgeMonths: 15,
        currentPriceEurPerMwh: 180,
        marketPunEurPerMwh: 100,
        offerType: "variabile",
      }),
    );
    expect(["high", "critical"]).toContain(critical.riskLevel);
  });

  it("drivers ordinati per contribuzione decrescente", () => {
    const r = predictChurn(makeInputs());
    for (let i = 1; i < r.drivers.length; i++) {
      expect(r.drivers[i - 1].contributionPct).toBeGreaterThanOrEqual(
        r.drivers[i].contributionPct,
      );
    }
  });

  it("gestisce gracefully marketPun = 0", () => {
    const r = predictChurn(makeInputs({ marketPunEurPerMwh: 0 }));
    expect(Number.isFinite(r.probability)).toBe(true);
    expect(r.probability).toBeGreaterThanOrEqual(0);
  });
});
