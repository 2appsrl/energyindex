/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  computeSparkSpread,
  computePercentiles,
  computeAtr,
  pearsonCorrelation,
  computeCorrelationMatrix,
  computePunPsvCrossSpread,
  computePsvTtfPremium,
} from "@/lib/pro/trading-math";

describe("computeSparkSpread", () => {
  it("baseline default heat rate 1.8 e emission 0.35", () => {
    // PUN 100, PSV 30, CO2 70 -> spark = 100 - 30*1.8 - 70*0.35 = 100 - 54 - 24.5 = 21.5
    const s = computeSparkSpread({ punEurPerMwh: 100, psvEurPerMwh: 30, co2EurPerTon: 70 });
    expect(s).toBeCloseTo(21.5, 2);
  });

  it("custom heat rate 2.0 = CCGT meno efficiente", () => {
    const s = computeSparkSpread({
      punEurPerMwh: 100,
      psvEurPerMwh: 30,
      co2EurPerTon: 70,
      heatRateMwhGasPerMwhEl: 2.0,
    });
    // 100 - 30*2 - 70*0.35 = 100 - 60 - 24.5 = 15.5
    expect(s).toBeCloseTo(15.5, 2);
  });

  it("spark negativo = centrale in shutdown", () => {
    const s = computeSparkSpread({ punEurPerMwh: 80, psvEurPerMwh: 50, co2EurPerTon: 80 });
    // 80 - 90 - 28 = -38
    expect(s).toBeCloseTo(-38, 2);
  });
});

describe("computePercentiles", () => {
  it("calcola percentili default su array ordinato", () => {
    const p = computePercentiles([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(p["0.5"]).toBeGreaterThanOrEqual(50);
    expect(p["0.9"]).toBeGreaterThanOrEqual(90);
  });

  it("array vuoto ritorna NaN", () => {
    const p = computePercentiles([]);
    expect(Number.isNaN(p["0.5"])).toBe(true);
  });
});

describe("computeAtr", () => {
  it("ATR su serie monotona crescente = 1 (range costante)", () => {
    const series = Array.from({ length: 20 }, (_, i) => 100 + i);
    const atr = computeAtr(series, 14);
    expect(atr[14]).toBeCloseTo(1, 4);
  });

  it("primi N giorni sono null", () => {
    const atr = computeAtr([100, 101, 102, 103, 104], 14);
    expect(atr[0]).toBeNull();
    expect(atr[2]).toBeNull();
  });
});

describe("pearsonCorrelation", () => {
  it("serie identiche -> correlazione 1", () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
    expect(r).toBeCloseTo(1, 4);
  });
  it("serie inverse -> correlazione -1", () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]);
    expect(r).toBeCloseTo(-1, 4);
  });
  it("serie indipendenti -> correlazione vicina a 0", () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5, 6, 7, 8], [3, 1, 4, 1, 5, 9, 2, 6]);
    expect(Math.abs(r)).toBeLessThan(0.5);
  });
});

describe("computeCorrelationMatrix", () => {
  it("matrice 2x2 con asset uguali ha diagonale 1", () => {
    const series = {
      pun: [
        { date: "2026-01-01", value: 100 },
        { date: "2026-01-02", value: 110 },
        { date: "2026-01-03", value: 120 },
        { date: "2026-01-04", value: 130 },
        { date: "2026-01-05", value: 140 },
        { date: "2026-01-06", value: 150 },
      ],
      ttf: [
        { date: "2026-01-01", value: 30 },
        { date: "2026-01-02", value: 31 },
        { date: "2026-01-03", value: 32 },
        { date: "2026-01-04", value: 33 },
        { date: "2026-01-05", value: 34 },
        { date: "2026-01-06", value: 35 },
      ],
    };
    const cells = computeCorrelationMatrix(series, 30);
    const diagPun = cells.find((c) => c.assetA === "pun" && c.assetB === "pun");
    expect(diagPun?.correlation).toBe(1);
  });
});

describe("cross spreads", () => {
  it("PUN-PSV positivo = power premium", () => {
    expect(computePunPsvCrossSpread(120, 30)).toBe(90);
  });
  it("PSV-TTF premio Italia tipico ~1-3", () => {
    expect(computePsvTtfPremium(33, 30)).toBe(3);
  });
});
