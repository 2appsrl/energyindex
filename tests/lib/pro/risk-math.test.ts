/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  computePositionMtm,
  computePortfolioSummary,
  computeVaR,
  computeStressTest,
  daysToDelivery,
  nearestForecastHorizon,
  STRESS_SCENARIOS,
  type Position,
  type ForecastByAsset,
  type AtrPctByAsset,
} from "@/lib/pro/risk-math";

const FC: ForecastByAsset = { pun: 110, psv: 32, ttf: 30 };
const ATR: AtrPctByAsset = { pun: 0.04, psv: 0.05, ttf: 0.06 };

function pos(overrides: Partial<Position> = {}): Position {
  return {
    id: "p1",
    asset: "pun",
    side: "BUY",
    volumeMwh: 100,
    executedPriceEurPerMwh: 100,
    deliveryMonth: "2026-09",
    ...overrides,
  };
}

describe("computePositionMtm", () => {
  it("BUY profitto se forecast > executed", () => {
    // (110 - 100) * 100 * (+1) = +1000
    const m = computePositionMtm(pos(), FC, ATR, 60);
    expect(m.mtmEur).toBeCloseTo(1000, 2);
    expect(m.forecastPriceEurPerMwh).toBe(110);
  });

  it("SELL profitto se forecast < executed", () => {
    // SELL @ 120, forecast 110 -> (110 - 120) * 100 * (-1) = +1000
    const m = computePositionMtm(
      pos({ side: "SELL", executedPriceEurPerMwh: 120 }),
      FC,
      ATR,
      60,
    );
    expect(m.mtmEur).toBeCloseTo(1000, 2);
  });

  it("BUY perdita se forecast < executed", () => {
    // BUY @ 130, forecast 110 -> (110 - 130) * 100 * 1 = -2000
    const m = computePositionMtm(pos({ executedPriceEurPerMwh: 130 }), FC, ATR, 60);
    expect(m.mtmEur).toBeCloseTo(-2000, 2);
  });

  it("hedge ratio clamp 0.9 quando volatility * tempo e' alto", () => {
    // vol PSV 0.10, time factor 1.0 (90g+), raw = 0.10*1*10 = 1.0 -> clamp 0.9
    const highVol: AtrPctByAsset = { pun: 0.04, psv: 0.1, ttf: 0.06 };
    const m = computePositionMtm(
      pos({ asset: "psv", executedPriceEurPerMwh: 30 }),
      FC,
      highVol,
      120,
    );
    expect(m.hedgeRatio).toBe(0.9);
  });

  it("hedge ratio scala con tempo: 0 giorni -> 0", () => {
    const m = computePositionMtm(pos(), FC, ATR, 0);
    expect(m.hedgeRatio).toBe(0);
  });

  it("hedge ratio intermedio: 30g + 4% vol = 30/90 * 0.04 * 10 = 0.133", () => {
    const m = computePositionMtm(pos(), FC, ATR, 30);
    expect(m.hedgeRatio).toBeCloseTo(0.4 / 3, 3);
  });
});

describe("computePortfolioSummary", () => {
  it("aggregato esposizione + MtM su multiple posizioni", () => {
    const positions = [
      pos({ id: "a", asset: "pun", side: "BUY", volumeMwh: 100, executedPriceEurPerMwh: 100 }),
      pos({ id: "b", asset: "psv", side: "SELL", volumeMwh: 200, executedPriceEurPerMwh: 35 }),
    ];
    const mtms = positions.map((p) => computePositionMtm(p, FC, ATR, 60));
    const summary = computePortfolioSummary(mtms);

    // Exposure: 100*100 + 200*35 = 10000 + 7000 = 17000
    expect(summary.totalExposureEur).toBeCloseTo(17000, 2);
    // Volume totale: 300
    expect(summary.totalVolumeMwh).toBe(300);
    // Net MtM:
    //  BUY PUN: (110-100)*100*+1 = +1000
    //  SELL PSV: (32-35)*200*-1 = +600
    expect(summary.netMtmEur).toBeCloseTo(1600, 2);
    // Avg margin: 1600/300
    expect(summary.avgMarginEurPerMwh).toBeCloseTo(1600 / 300, 4);
    // Breakdown
    expect(summary.byAsset.pun.exposure).toBeCloseTo(10000, 2);
    expect(summary.byAsset.psv.exposure).toBeCloseTo(7000, 2);
    expect(summary.byAsset.ttf.exposure).toBe(0);
  });

  it("portafoglio vuoto -> tutti zero", () => {
    const s = computePortfolioSummary([]);
    expect(s.totalExposureEur).toBe(0);
    expect(s.netMtmEur).toBe(0);
    expect(s.totalVolumeMwh).toBe(0);
    expect(s.avgMarginEurPerMwh).toBe(0);
  });
});

describe("computeVaR", () => {
  it("formula 1.645 * exposure * vol per 1g 95%", () => {
    // Singola posizione PUN 100 MWh @ 100 EUR -> exposure 10000, vol 4% -> 1d95 = 1.645*10000*0.04 = 658
    const mtms = [computePositionMtm(pos(), FC, ATR, 60)];
    const summary = computePortfolioSummary(mtms);
    const v = computeVaR(summary, ATR);
    expect(v.var1d95).toBeCloseTo(658, 0);
    expect(v.var1d99).toBeCloseTo(2.326 * 10000 * 0.04, 0);
    expect(v.var10d95).toBeCloseTo(v.var1d95 * Math.sqrt(10), 1);
    expect(v.portfolioVolatilityPct).toBeCloseTo(0.04, 4);
  });

  it("portfolio vuoto -> tutti zero", () => {
    const v = computeVaR(computePortfolioSummary([]), ATR);
    expect(v.var1d95).toBe(0);
    expect(v.var1d99).toBe(0);
    expect(v.var10d95).toBe(0);
    expect(v.var10d99).toBe(0);
    expect(v.portfolioVolatilityPct).toBe(0);
  });

  it("media pesata vol su mix PUN+TTF", () => {
    // PUN 100 MWh @ 100 = 10000, TTF 100 MWh @ 30 = 3000 -> totale 13000
    // weighted vol = (10000/13000)*0.04 + (3000/13000)*0.06
    const mtms = [
      computePositionMtm(pos({ id: "a", asset: "pun" }), FC, ATR, 60),
      computePositionMtm(pos({ id: "b", asset: "ttf", executedPriceEurPerMwh: 30 }), FC, ATR, 60),
    ];
    const summary = computePortfolioSummary(mtms);
    const v = computeVaR(summary, ATR);
    const expected = (10000 / 13000) * 0.04 + (3000 / 13000) * 0.06;
    expect(v.portfolioVolatilityPct).toBeCloseTo(expected, 5);
  });
});

describe("computeStressTest", () => {
  it("TTF +30% scenario: shock pun+15, psv+28, ttf+30", () => {
    // 1 posizione BUY PUN @ 100 con forecast baseline 110
    // Stressed forecast PUN = 110 * 1.15 = 126.5
    // Stressed MtM = (126.5 - 100) * 100 * 1 = 2650
    // Baseline MtM = (110 - 100) * 100 = 1000
    // Delta = 1650
    const mtms = [computePositionMtm(pos(), FC, ATR, 60)];
    const summary = computePortfolioSummary(mtms);
    const ttfUp = STRESS_SCENARIOS.find((s) => s.id === "ttf_up_30")!;
    const r = computeStressTest(mtms, summary, ttfUp, FC);
    expect(r.deltaPnlEur).toBeCloseTo(1650, 2);
    expect(r.newNetMtmEur).toBeCloseTo(2650, 2);
    expect(r.pctOfExposure).toBeCloseTo(1650 / 10000, 4);
  });

  it("SELL position perde con TTF +30%", () => {
    // SELL PUN @ 100, forecast 110 -> baseline MtM = (110-100)*100*-1 = -1000
    // Stressed forecast = 126.5 -> stressed MtM = (126.5-100)*100*-1 = -2650
    // Delta = -1650
    const mtms = [computePositionMtm(pos({ side: "SELL" }), FC, ATR, 60)];
    const summary = computePortfolioSummary(mtms);
    const ttfUp = STRESS_SCENARIOS.find((s) => s.id === "ttf_up_30")!;
    const r = computeStressTest(mtms, summary, ttfUp, FC);
    expect(r.deltaPnlEur).toBeCloseTo(-1650, 2);
  });

  it("recession scenario tutti shock negativi", () => {
    const rec = STRESS_SCENARIOS.find((s) => s.id === "recession")!;
    expect(rec.shocks.pun).toBeLessThan(0);
    expect(rec.shocks.psv).toBeLessThan(0);
    expect(rec.shocks.ttf).toBeLessThan(0);
  });
});

describe("daysToDelivery", () => {
  it("delivery futuro positivo (15 del mese)", () => {
    // Today fisso al 2026-05-19. Delivery 2026-07-15 -> circa 57 giorni
    const today = new Date(Date.UTC(2026, 4, 19));
    const d = daysToDelivery("2026-07", today);
    expect(d).toBe(57);
  });

  it("delivery passato -> 0", () => {
    const today = new Date(Date.UTC(2026, 4, 19));
    const d = daysToDelivery("2026-01", today);
    expect(d).toBe(0);
  });

  it("delivery month malformato -> default 30", () => {
    const d = daysToDelivery("garbage");
    expect(d).toBe(30);
  });
});

describe("nearestForecastHorizon", () => {
  it("0 giorni -> 7g (minimo disponibile)", () => {
    expect(nearestForecastHorizon(0)).toBe(7);
  });

  it("15 giorni -> 7g (entro 18)", () => {
    expect(nearestForecastHorizon(15)).toBe(7);
  });

  it("20 giorni -> 30g", () => {
    expect(nearestForecastHorizon(20)).toBe(30);
  });

  it("75 giorni -> 90g", () => {
    expect(nearestForecastHorizon(75)).toBe(90);
  });

  it("200 giorni -> 180g (cap)", () => {
    expect(nearestForecastHorizon(200)).toBe(180);
  });

  it("boundaries: 18 -> 7, 19 -> 30", () => {
    expect(nearestForecastHorizon(18)).toBe(7);
    expect(nearestForecastHorizon(19)).toBe(30);
    expect(nearestForecastHorizon(60)).toBe(30);
    expect(nearestForecastHorizon(61)).toBe(90);
    expect(nearestForecastHorizon(135)).toBe(90);
    expect(nearestForecastHorizon(136)).toBe(180);
  });
});
