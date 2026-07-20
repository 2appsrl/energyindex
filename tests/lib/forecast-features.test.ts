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
  buildLatestFeatureRow,
  alignDriverToTarget,
  TEMPERATURE_DRIVER_KEY,
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

describe("isItalianHoliday — observance vs public", () => {
  it("Mother's Day 2026 (osservanza) → false", () => {
    // Festa della Mamma 2026 = 2a domenica di maggio = 2026-05-10
    expect(isItalianHoliday(new Date("2026-05-10T12:00:00Z"))).toBe(false);
  });
  it("Ferragosto 2026 (pubblica) → true", () => {
    expect(isItalianHoliday(new Date("2026-08-15T12:00:00Z"))).toBe(true);
  });
  it("25 aprile 2026 (Liberazione, pubblica) → true", () => {
    expect(isItalianHoliday(new Date("2026-04-25T12:00:00Z"))).toBe(true);
  });
});

describe("buildLatestFeatureRow", () => {
  it("ritorna l'ultima riga di features con metadata", () => {
    const target: SeriesPoint[] = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1));
      d.setUTCDate(d.getUTCDate() + i);
      return { date: d, value: 100 + i };
    });
    const drivers = {
      ttf: target.map((p) => ({ date: p.date, value: 30 })),
      temperature: target.map((p) => ({ date: p.date, value: 15 })),
    };
    const row = buildLatestFeatureRow({ target, drivers, meteoForecast: null });
    expect(row).not.toBeNull();
    expect(row!.row.length).toBe(row!.featureNames.length);
    expect(row!.row.every(Number.isFinite)).toBe(true);
    // L'ultima data target e' 2026-03-01 (60 giorni partendo da 2026-01-01)
    // Per horizon=0 in buildFeatureMatrix, dates[] = target[i] del massimo i valido
    expect(row!.date.getTime()).toBeLessThanOrEqual(target[target.length - 1].date.getTime());
  });

  it("ritorna null se non c'e' abbastanza storico", () => {
    const target: SeriesPoint[] = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1));
      d.setUTCDate(d.getUTCDate() + i);
      return { date: d, value: 100 + i };
    });
    const drivers = {
      ttf: target.map((p) => ({ date: p.date, value: 30 })),
      temperature: target.map((p) => ({ date: p.date, value: 15 })),
    };
    expect(buildLatestFeatureRow({ target, drivers, meteoForecast: null })).toBeNull();
  });
});

describe("buildFeatureMatrix — temperature key contract", () => {
  it("ritorna X vuoto se manca driver temperature (silent contract)", () => {
    const target: SeriesPoint[] = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1));
      d.setUTCDate(d.getUTCDate() + i);
      return { date: d, value: 100 + i };
    });
    const drivers = {
      ttf: target.map((p) => ({ date: p.date, value: 30 })),
      // temperature missing -- contract violation
    };
    const out = buildFeatureMatrix({ target, drivers, meteoForecast: null, horizonDays: 7 });
    expect(out.X.length).toBe(0);
    expect(out.y.length).toBe(0);
  });

  it("esporta TEMPERATURE_DRIVER_KEY = 'temperature' (contratto con orchestrator)", () => {
    expect(TEMPERATURE_DRIVER_KEY).toBe("temperature");
  });
});

describe("buildFeatureMatrix — warmup truncation length", () => {
  it("X.length = n - maxLag (30) - horizon, +/- 1 per gestione confini", () => {
    const N = 100;
    const target: SeriesPoint[] = Array.from({ length: N }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1));
      d.setUTCDate(d.getUTCDate() + i);
      return { date: d, value: 100 + i };
    });
    const drivers = {
      ttf: target.map((p) => ({ date: p.date, value: 30 })),
      temperature: target.map((p) => ({ date: p.date, value: 15 })),
    };
    const horizon = 7;
    const out = buildFeatureMatrix({ target, drivers, meteoForecast: null, horizonDays: horizon });
    // Atteso: indici i tali che maxLag(30) <= i e i+horizon < N => i in [30, 92] => 63 righe
    expect(out.X.length).toBe(N - 30 - horizon);
    expect(out.dates.length).toBe(N - 30 - horizon);
  });
});

describe("rollingStd / rollingMean — boundary conditions", () => {
  it("rollingStd con window=1 ritorna tutto null", () => {
    expect(rollingStd([1, 2, 3], 1)).toEqual([null, null, null]);
  });
  it("rollingMean con window = length ritorna mean solo all'ultimo indice", () => {
    const out = rollingMean([1, 2, 3, 4], 4);
    expect(out).toEqual([null, null, null, 2.5]);
  });
});

describe("alignDriverToTarget", () => {
  it("riempie NaN per le date target mancanti nel driver", () => {
    const target: SeriesPoint[] = [
      { date: new Date(Date.UTC(2026, 0, 1, 12)), value: 100 },
      { date: new Date(Date.UTC(2026, 0, 2, 12)), value: 110 },
      { date: new Date(Date.UTC(2026, 0, 3, 12)), value: 120 },
    ];
    const driver: SeriesPoint[] = [
      { date: new Date(Date.UTC(2026, 0, 2, 12)), value: 50 },
    ];
    const aligned = alignDriverToTarget(target, driver);
    expect(aligned).toHaveLength(3);
    expect(aligned[0].value).toBeNaN();
    expect(aligned[1].value).toBe(50);
    expect(aligned[2].value).toBeNaN();
  });

  it("preserva l'ordine cronologico di target", () => {
    const target: SeriesPoint[] = [
      { date: new Date(Date.UTC(2026, 0, 1, 12)), value: 100 },
      { date: new Date(Date.UTC(2026, 0, 2, 12)), value: 110 },
    ];
    const driver: SeriesPoint[] = [
      { date: new Date(Date.UTC(2026, 0, 2, 12)), value: 50 },
      { date: new Date(Date.UTC(2026, 0, 1, 12)), value: 30 },
    ];
    const aligned = alignDriverToTarget(target, driver);
    expect(aligned[0].date.getTime()).toBe(target[0].date.getTime());
    expect(aligned[0].value).toBe(30);
    expect(aligned[1].value).toBe(50);
  });
});

describe("buildFeatureMatrix — driver shorter than target", () => {
  it("non lancia se un driver ha lunghezza minore del target", () => {
    const target: SeriesPoint[] = Array.from({ length: 100 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 0, 1));
      d.setUTCDate(d.getUTCDate() + i);
      return { date: d, value: 100 + i };
    });
    // ttf driver completo
    const ttf = target.map((p) => ({ date: p.date, value: 30 }));
    // co2 driver SOLO sugli ultimi 20 giorni
    const co2Sub = target.slice(80).map((p) => ({ date: p.date, value: 70 }));
    const co2 = alignDriverToTarget(target, co2Sub);
    const temperature = target.map((p) => ({ date: p.date, value: 15 }));

    const out = buildFeatureMatrix({
      target,
      drivers: { ttf, co2, temperature },
      meteoForecast: null,
      horizonDays: 7,
    });
    // X.length deve essere ridotto (le righe iniziali hanno co2=NaN e vengono filtrate),
    // ma NON deve throw.
    expect(out.X.length).toBeGreaterThanOrEqual(0);
    // Tutte le righe valide hanno valori finiti
    for (const row of out.X) {
      for (const v of row) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
