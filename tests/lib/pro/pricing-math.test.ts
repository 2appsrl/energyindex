/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  computePriceLadder,
  CLUSTERS,
  getCluster,
  type CompetitorBenchmark,
} from "@/lib/pro/pricing-math";

const BENCHMARK: CompetitorBenchmark = {
  p25: 5,
  median: 10,
  p75: 18,
  nOfferte: 100,
};

describe("CLUSTERS registry", () => {
  it("contiene 5 cluster", () => {
    expect(CLUSTERS).toHaveLength(5);
  });

  it("solo 'pmi' e' unlocked nel demo", () => {
    const unlocked = CLUSTERS.filter((c) => !c.locked);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].id).toBe("pmi");
  });

  it("getCluster by id", () => {
    expect(getCluster("pmi")?.label).toBe("PMI commerciale");
    expect(getCluster("ho_re_ca")?.locked).toBe(true);
  });
});

describe("computePriceLadder", () => {
  const pmi = getCluster("pmi")!;

  it("ritorna sempre 3 price point", () => {
    const r = computePriceLadder(pmi, BENCHMARK, 120);
    expect(r.ladder).toHaveLength(3);
  });

  it("aggressive ha spread piu' basso, premium piu' alto", () => {
    const r = computePriceLadder(pmi, BENCHMARK, 120);
    expect(r.ladder[0].spreadEurPerMwh).toBeLessThan(r.ladder[1].spreadEurPerMwh);
    expect(r.ladder[1].spreadEurPerMwh).toBeLessThan(r.ladder[2].spreadEurPerMwh);
  });

  it("aggressive ha take-rate piu' alto (price-sensitive)", () => {
    const r = computePriceLadder(pmi, BENCHMARK, 120);
    expect(r.ladder[0].takeRate).toBeGreaterThan(r.ladder[1].takeRate);
    expect(r.ladder[1].takeRate).toBeGreaterThan(r.ladder[2].takeRate);
  });

  it("take-rate sempre clampato a [0.02, 0.95]", () => {
    const r = computePriceLadder(pmi, BENCHMARK, 120);
    for (const p of r.ladder) {
      expect(p.takeRate).toBeGreaterThanOrEqual(0.02);
      expect(p.takeRate).toBeLessThanOrEqual(0.95);
    }
  });

  it("optimalIndex punta al massimo expected margin", () => {
    const r = computePriceLadder(pmi, BENCHMARK, 120);
    const maxMargin = Math.max(...r.ladder.map((p) => p.expectedMarginPer100Prospects));
    expect(r.ladder[r.optimalIndex].expectedMarginPer100Prospects).toBe(maxMargin);
  });

  it("cluster industriale (low elasticita') -> take-rate meno sensibili allo sconto", () => {
    const ind = getCluster("industriale")!;
    const indResult = computePriceLadder(ind, BENCHMARK, 120);
    const pmiResult = computePriceLadder(pmi, BENCHMARK, 120);
    // Lo sconto dell'aggressive lift il take-rate di MENO per industriale
    const indLift = indResult.ladder[0].takeRate - indResult.ladder[1].takeRate;
    const pmiLift = pmiResult.ladder[0].takeRate - pmiResult.ladder[1].takeRate;
    expect(indLift).toBeLessThan(pmiLift);
  });

  it("margine per acquired = spread × volume / 1000", () => {
    const r = computePriceLadder(pmi, BENCHMARK, 120);
    for (const p of r.ladder) {
      const expected = (p.spreadEurPerMwh / 1000) * pmi.typicalAnnualKwh;
      expect(p.marginPerAcquiredEur).toBeCloseTo(expected, 2);
    }
  });

  it("expectedMargin100 = marginPerAcquired × 100 × takeRate", () => {
    const r = computePriceLadder(pmi, BENCHMARK, 120);
    for (const p of r.ladder) {
      const expected = p.marginPerAcquiredEur * 100 * p.takeRate;
      expect(p.expectedMarginPer100Prospects).toBeCloseTo(expected, 2);
    }
  });
});
