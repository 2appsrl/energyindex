/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  simulate,
  computeSharpe,
  computeMaxDrawdown,
  type PricePoint,
  type Position,
} from "@/lib/pro/backtest-math";
import { STRATEGIES, getStrategy } from "@/lib/pro/backtest-strategies";

function makeSeries(prices: number[], startDate = "2026-01-01"): PricePoint[] {
  const out: PricePoint[] = [];
  const base = new Date(startDate + "T00:00:00Z").getTime();
  for (let i = 0; i < prices.length; i++) {
    const d = new Date(base + i * 86400000);
    out.push({ date: d.toISOString().slice(0, 10), close: prices[i] });
  }
  return out;
}

describe("simulate", () => {
  it("returns empty result for n < 2", () => {
    const r = simulate([], [], 1);
    expect(r.trades).toHaveLength(0);
    expect(r.equityCurve).toHaveLength(0);
    expect(r.metrics.numTrades).toBe(0);
  });

  it("zero P&L quando sempre flat", () => {
    const series = makeSeries([100, 110, 90, 105]);
    const signals: Position[] = [0, 0, 0, 0];
    const r = simulate(series, signals, 1);
    expect(r.metrics.totalReturnEur).toBe(0);
    expect(r.metrics.numTrades).toBe(0);
  });

  it("long persistente cattura aumento prezzo close-to-close", () => {
    const series = makeSeries([100, 110, 120, 130]);
    // signals[0]=1 means: hold long from end of day 0 to end of day 1
    // signals[1]=1 means: hold long from end of day 1 to end of day 2
    // ...
    const signals: Position[] = [1, 1, 1, 1];
    const r = simulate(series, signals, 1);
    // PnL day1 = (110-100)*1 = 10; day2 = 10; day3 = 10 -> totale 30
    expect(r.metrics.totalReturnEur).toBe(30);
  });

  it("short cattura calo prezzo", () => {
    const series = makeSeries([100, 90, 80]);
    const signals: Position[] = [-1, -1, -1];
    const r = simulate(series, signals, 1);
    // -1 short: PnL day1 = (90-100)*(-1) = 10; day2 = (80-90)*(-1) = 10 -> 20
    expect(r.metrics.totalReturnEur).toBe(20);
  });

  it("size > 1 scala il P&L proporzionalmente", () => {
    const series = makeSeries([100, 110]);
    const signals: Position[] = [1, 1];
    const r = simulate(series, signals, 5);
    // PnL = (110-100)*1*5 = 50
    expect(r.metrics.totalReturnEur).toBe(50);
  });

  it("rileva un trade long aperto e chiuso", () => {
    const series = makeSeries([100, 105, 115, 110]);
    // Long apre a fine giorno 1 (signal passa da 0 a 1), chiude a fine giorno 2 (da 1 a 0)
    const signals: Position[] = [0, 1, 1, 0];
    const r = simulate(series, signals, 1);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].side).toBe("long");
    expect(r.trades[0].entryPrice).toBe(105);
    expect(r.trades[0].exitPrice).toBe(110); // exit at idx 3 (signal 1->0 transition)
    expect(r.trades[0].pnlEur).toBe(5);
  });

  it("chiude posizione aperta a fine serie", () => {
    const series = makeSeries([100, 105, 115]);
    const signals: Position[] = [0, 1, 1];
    const r = simulate(series, signals, 1);
    // Trade aperto a 105, chiusura forzata a 115 -> PnL = 10
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].pnlEur).toBe(10);
  });

  it("flip long->short genera due trade", () => {
    const series = makeSeries([100, 110, 120, 110, 100]);
    const signals: Position[] = [0, 1, 1, -1, -1];
    const r = simulate(series, signals, 1);
    // Walk-forward: long apre a fine idx 1 (price 110), flip a fine idx 3 (price 110)
    //   -> long entry@110 exit@110 = 0 (sale a 120 e torna a 110 mentre long)
    // Short apre a fine idx 3 (price 110), chiusura forzata fine serie a idx 4 (price 100)
    //   -> short entry@110 exit@100 = +10
    expect(r.trades).toHaveLength(2);
    expect(r.trades[0].side).toBe("long");
    expect(r.trades[0].pnlEur).toBe(0);
    expect(r.trades[1].side).toBe("short");
    expect(r.trades[1].pnlEur).toBe(10);
  });

  it("win rate corretto su mix di trade", () => {
    const series = makeSeries([100, 110, 90, 80, 100]);
    //                              ^entry   ^exit  (long: -20)
    //                                      ^entry  ^exit (long: +20)
    const signals: Position[] = [0, 1, 0, 1, 0];
    const r = simulate(series, signals, 1);
    expect(r.trades).toHaveLength(2);
    expect(r.metrics.winRate).toBe(0.5);
  });

  it("equity curve ha N punti come la serie", () => {
    const series = makeSeries([100, 105, 110, 115, 120]);
    const signals: Position[] = [0, 1, 1, 1, 1];
    const r = simulate(series, signals, 1);
    expect(r.equityCurve).toHaveLength(5);
    expect(r.equityCurve[0].equity).toBe(0);
    expect(r.equityCurve[4].equity).toBe(15); // somma dei daily P&L
  });

  it("drawdown tracciato sull'equity curve", () => {
    const series = makeSeries([100, 110, 120, 100, 110]);
    // Long persistente: equity 0, 10, 20, 0, 10
    const signals: Position[] = [1, 1, 1, 1, 1];
    const r = simulate(series, signals, 1);
    // Peak a 20 (idx 2), poi giù a 0 (idx 3) -> DD = 20
    expect(r.metrics.maxDrawdownEur).toBe(20);
    expect(r.equityCurve[3].drawdownEur).toBe(20);
  });
});

describe("computeSharpe", () => {
  it("0 per array vuoto", () => {
    expect(computeSharpe([])).toBe(0);
  });

  it("0 per varianza nulla", () => {
    expect(computeSharpe([1, 1, 1, 1])).toBe(0);
  });

  it("positivo per returns positivi", () => {
    const r = computeSharpe([1, 2, 1, 2, 1, 2]);
    expect(r).toBeGreaterThan(0);
  });

  it("negativo per returns negativi medi", () => {
    const r = computeSharpe([-1, -2, -1, -2, -1, -2]);
    expect(r).toBeLessThan(0);
  });

  it("scala con sqrt(periodsPerYear)", () => {
    const ret = [0.01, 0.02, 0.005, 0.015];
    const s252 = computeSharpe(ret, 252);
    const s1 = computeSharpe(ret, 1);
    expect(s252 / s1).toBeCloseTo(Math.sqrt(252), 3);
  });
});

describe("computeMaxDrawdown", () => {
  it("zero per equity monotonicamente crescente", () => {
    const dd = computeMaxDrawdown([0, 10, 20, 30, 40]);
    expect(dd.value).toBe(0);
    expect(dd.pct).toBe(0);
  });

  it("cattura il massimo drawdown peak-to-trough", () => {
    // peak 100 a idx 1, trough 60 a idx 3
    const dd = computeMaxDrawdown([0, 100, 80, 60, 90]);
    expect(dd.value).toBe(40);
    expect(dd.pct).toBeCloseTo(0.4, 4);
    expect(dd.peakIdx).toBe(1);
    expect(dd.troughIdx).toBe(3);
  });

  it("pct = 0 se peak <= 0 (sempre in perdita)", () => {
    const dd = computeMaxDrawdown([0, -10, -20, -5]);
    expect(dd.value).toBe(20);
    expect(dd.pct).toBe(0);
  });
});

describe("STRATEGIES registry", () => {
  it("contiene esattamente 4 strategie", () => {
    expect(STRATEGIES).toHaveLength(4);
  });

  it("solo mean-reversion-pun e' unlocked", () => {
    const unlocked = STRATEGIES.filter((s) => !s.locked);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].id).toBe("mean-reversion-pun");
  });

  it("getStrategy by id", () => {
    expect(getStrategy("mean-reversion-pun")?.name).toBe("Mean Reversion PUN");
    expect(getStrategy("seasonality-pun")?.locked).toBe(true);
  });
});

describe("mean reversion strategy", () => {
  it("genera segnali su serie oscillante sinusoidale", () => {
    // 200 giorni, ampiezza 20 intorno a 100
    const series = makeSeries(
      Array.from({ length: 200 }, (_, i) => 100 + 20 * Math.sin(i / 5)),
    );
    const strat = getStrategy("mean-reversion-pun")!;
    const signals = strat.signalFn(series, {}, strat.params);
    expect(signals).toHaveLength(200);
    // Deve aver generato almeno qualche posizione non-flat
    const nonFlat = signals.filter((s) => s !== 0).length;
    expect(nonFlat).toBeGreaterThan(10);
  });

  it("profitta su serie mean-reverting", () => {
    const series = makeSeries(
      Array.from({ length: 200 }, (_, i) => 100 + 20 * Math.sin(i / 5)),
    );
    const strat = getStrategy("mean-reversion-pun")!;
    const signals = strat.signalFn(series, {}, strat.params);
    const r = simulate(series, signals, 1);
    expect(r.metrics.totalReturnEur).toBeGreaterThan(0);
  });

  it("primi N giorni sempre flat (no signal pre-warmup)", () => {
    const series = makeSeries(Array.from({ length: 50 }, (_, i) => 100 + i));
    const strat = getStrategy("mean-reversion-pun")!;
    const signals = strat.signalFn(series, {}, strat.params);
    // window = 20 default, primi 20 devono essere 0
    for (let i = 0; i < 20; i++) {
      expect(signals[i]).toBe(0);
    }
  });
});

describe("momentum breakout strategy", () => {
  it("entra long su trend up consistente", () => {
    // Serie con un trend up dopo un periodo laterale
    const flat = Array.from({ length: 25 }, () => 100 + (Math.random() - 0.5) * 2);
    const trend = Array.from({ length: 25 }, (_, i) => 102 + i * 2);
    const series = makeSeries([...flat, ...trend]);
    const strat = getStrategy("momentum-breakout-pun")!;
    const signals = strat.signalFn(series, {}, strat.params);
    // Deve aver aperto una posizione long nella seconda metà
    const lastHalfLongs = signals.slice(30).filter((s) => s === 1).length;
    expect(lastHalfLongs).toBeGreaterThan(5);
  });
});

describe("seasonality strategy", () => {
  it("long solo da settembre a febbraio", () => {
    const dates = [
      "2026-01-15", "2026-03-15", "2026-06-15", "2026-08-15",
      "2026-09-15", "2026-12-15", "2027-02-15", "2027-03-15",
    ];
    const series: PricePoint[] = dates.map((d) => ({ date: d, close: 100 }));
    const strat = getStrategy("seasonality-pun")!;
    const signals = strat.signalFn(series, {}, strat.params);
    expect(signals).toEqual([1, 0, 0, 0, 1, 1, 1, 0]);
  });
});
