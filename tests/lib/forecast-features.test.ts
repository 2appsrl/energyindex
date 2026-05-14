/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  buildLagFeatures,
  rollingMean,
  rollingStd,
  computeHDD,
  computeCDD,
  dayOfWeekOneHot,
  monthOneHot,
  seasonalCyclic,
  isItalianHoliday,
  buildFeatureMatrix,
  type SeriesPoint,
} from "@/lib/forecast/features";

describe("rollingMean", () => {
  it("calcola media mobile semplice", () => {
    expect(rollingMean([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it("ritorna null se finestra > array", () => {
    expect(rollingMean([1, 2], 5)).toEqual([null, null]);
  });
});

describe("rollingStd", () => {
  it("calcola dev std mobile (popolazione)", () => {
    const out = rollingStd([2, 4, 4, 4, 5, 5, 7, 9], 4);
    expect(out[3]).toBeCloseTo(0.866, 2);
  });
});

describe("buildLagFeatures", () => {
  it("estrae i lag richiesti", () => {
    const series: SeriesPoint[] = [
      { date: new Date("2026-05-01T12:00:00Z"), value: 10 },
      { date: new Date("2026-05-02T12:00:00Z"), value: 11 },
      { date: new Date("2026-05-03T12:00:00Z"), value: 12 },
      { date: new Date("2026-05-04T12:00:00Z"), value: 13 },
    ];
    const lags = buildLagFeatures(series, [1, 2]);
    expect(lags).toHaveLength(4);
    expect(lags[0]).toEqual({ lag_1: null, lag_2: null });
    expect(lags[2]).toEqual({ lag_1: 11, lag_2: 10 });
    expect(lags[3]).toEqual({ lag_1: 12, lag_2: 11 });
  });
});

describe("computeHDD / computeCDD", () => {
  it("HDD = max(18 - T, 0)", () => {
    expect(computeHDD(10)).toBe(8);
    expect(computeHDD(20)).toBe(0);
  });
  it("CDD = max(T - 21, 0)", () => {
    expect(computeCDD(15)).toBe(0);
    expect(computeCDD(25)).toBe(4);
  });
});

describe("dayOfWeekOneHot", () => {
  it("ritorna 7 feature, una per giorno", () => {
    const monday = new Date("2026-05-11T12:00:00Z"); // Mon
    const out = dayOfWeekOneHot(monday);
    expect(Object.keys(out)).toHaveLength(7);
    expect(out.dow_1).toBe(1); // Monday = 1 (ISO)
    expect(out.dow_0).toBe(0); // Sunday = 0
  });
});

describe("monthOneHot", () => {
  it("ritorna 12 feature una per mese (1..12)", () => {
    const may = new Date("2026-05-15T12:00:00Z");
    const out = monthOneHot(may);
    expect(Object.keys(out)).toHaveLength(12);
    expect(out.month_5).toBe(1);
    expect(out.month_1).toBe(0);
  });
});

describe("seasonalCyclic", () => {
  it("sin/cos annual + weekly", () => {
    const newYear = new Date("2026-01-01T12:00:00Z");
    const out = seasonalCyclic(newYear);
    expect(out.sin_year).toBeCloseTo(Math.sin((2 * Math.PI * 0) / 365), 4);
    expect(out.cos_year).toBeCloseTo(Math.cos((2 * Math.PI * 0) / 365), 4);
    expect(typeof out.sin_week).toBe("number");
    expect(typeof out.cos_week).toBe("number");
  });
});

describe("isItalianHoliday", () => {
  it("riconosce Capodanno", () => {
    expect(isItalianHoliday(new Date("2026-01-01T12:00:00Z"))).toBe(true);
  });
  it("ritorna false in giorno feriale", () => {
    expect(isItalianHoliday(new Date("2026-03-04T12:00:00Z"))).toBe(false);
  });
});

describe("buildFeatureMatrix", () => {
  it("costruisce matrice training: target shift by horizon, allinea i driver", () => {
    // Usiamo aritmetica esplicita su Date per evitare overflow di stringhe tipo "2026-01-32".
    const target: SeriesPoint[] = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1));
      d.setUTCDate(d.getUTCDate() + i);
      return { date: d, value: 100 + i };
    });
    // Sanity check: tutte le date sono valide
    expect(Number.isNaN(target[59].date.getTime())).toBe(false);

    // Driver con stessa lunghezza
    const ttf = target.map((p) => ({ date: p.date, value: 30 + (p.value - 100) * 0.1 }));
    const temperature = target.map((p) => ({ date: p.date, value: 15 }));

    const { X, y, featureNames, dates } = buildFeatureMatrix({
      target,
      drivers: { ttf, temperature },
      meteoForecast: null,
      horizonDays: 7,
    });

    // Per horizon 7 con lag_30 max, perdiamo righe iniziali (warmup) + ultime 7 (no target futuro)
    expect(X.length).toBe(y.length);
    expect(X.length).toBeGreaterThan(0);
    expect(X[0].length).toBe(featureNames.length);
    expect(dates.length).toBe(X.length);
    // Tutti i valori finiti (no NaN/null nelle righe finali)
    for (const row of X) for (const v of row) expect(Number.isFinite(v)).toBe(true);
  });
});
