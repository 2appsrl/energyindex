/**
 * Feature engineering puro per i modelli forecast.
 *
 * Pure functions: nessun I/O, nessuna dipendenza Supabase.
 * Test in tests/lib/forecast-features.test.ts.
 *
 * Convenzione: il target e' una serie giornaliera (1 punto per giorno UTC).
 * I driver si assumono allineati allo stesso indice temporale del target.
 * Eventuali buchi (weekend, festivi senza dato) vanno gestiti dal caller
 * via interpolazione lineare PRIMA di chiamare buildFeatureMatrix.
 *
 * CONSTRAINT: questo modulo NON deve essere importato da Client Components
 * (`"use client"`). La libreria date-holidays trascina moment (~5MB) +
 * astronomia (~18MB) nel bundle. Originariamente avevamo `import "server-only"`
 * a protezione, ma quel modulo lancia anche dai Node script tsx (no
 * RSC bundler) e bloccava run-forecast-daily / backfill-forecast-history.
 * La protezione e' ora solo a livello di convenzione: orchestrator.ts
 * (importatore unico user-facing) e' richiesto solo da server components
 * (page.tsx, Server Actions) e da Node script (scripts/*.ts).
 */
import Holidays from "date-holidays";

export interface SeriesPoint {
  date: Date;
  value: number;
}

const HDD_BASE = 18;
const CDD_BASE = 21;

const italyHolidays = new Holidays("IT");

const holidayCache = new Map<string, boolean>();

export const TEMPERATURE_DRIVER_KEY = "temperature";

export function computeHDD(temperature: number): number {
  return Math.max(HDD_BASE - temperature, 0);
}

export function computeCDD(temperature: number): number {
  return Math.max(temperature - CDD_BASE, 0);
}

export function rollingMean(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (window <= 0 || window > values.length) return out;
  let sum = 0;
  for (let i = 0; i < window; i++) sum += values[i];
  out[window - 1] = sum / window;
  for (let i = window; i < values.length; i++) {
    sum += values[i] - values[i - window];
    out[i] = sum / window;
  }
  return out;
}

export function rollingStd(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (window <= 1 || window > values.length) return out;
  for (let i = window - 1; i < values.length; i++) {
    let sum = 0;
    for (let k = i - window + 1; k <= i; k++) sum += values[k];
    const mean = sum / window;
    let sq = 0;
    for (let k = i - window + 1; k <= i; k++) sq += (values[k] - mean) ** 2;
    out[i] = Math.sqrt(sq / window);
  }
  return out;
}

/**
 * Aligns a driver series to target's date axis. For each date in target,
 * returns the driver's value at that date, or NaN if missing.
 * Both series assumed to use mezzogiorno UTC (T12:00:00Z) as the daily key.
 */
export function alignDriverToTarget(
  target: SeriesPoint[],
  driver: SeriesPoint[],
): SeriesPoint[] {
  const dayKey = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const byDay = new Map<string, number>();
  for (const p of driver) byDay.set(dayKey(p.date), p.value);
  return target.map((p) => ({
    date: p.date,
    value: byDay.get(dayKey(p.date)) ?? Number.NaN,
  }));
}

export function buildLagFeatures(
  series: SeriesPoint[],
  lags: number[],
): Record<string, number | null>[] {
  return series.map((_, i) => {
    const out: Record<string, number | null> = {};
    for (const lag of lags) {
      const j = i - lag;
      out[`lag_${lag}`] = j >= 0 ? series[j].value : null;
    }
    return out;
  });
}

export function dayOfWeekOneHot(d: Date): Record<string, number> {
  const dow = d.getUTCDay(); // 0..6, Sun=0
  const out: Record<string, number> = {};
  for (let i = 0; i < 7; i++) out[`dow_${i}`] = dow === i ? 1 : 0;
  return out;
}

export function monthOneHot(d: Date): Record<string, number> {
  const m = d.getUTCMonth() + 1; // 1..12
  const out: Record<string, number> = {};
  for (let i = 1; i <= 12; i++) out[`month_${i}`] = m === i ? 1 : 0;
  return out;
}

export function seasonalCyclic(d: Date): {
  sin_year: number;
  cos_year: number;
  sin_week: number;
  cos_week: number;
} {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - start) / 86400000);
  const dow = d.getUTCDay();
  return {
    sin_year: Math.sin((2 * Math.PI * dayOfYear) / 365),
    cos_year: Math.cos((2 * Math.PI * dayOfYear) / 365),
    sin_week: Math.sin((2 * Math.PI * dow) / 7),
    cos_week: Math.cos((2 * Math.PI * dow) / 7),
  };
}

export function isItalianHoliday(d: Date): boolean {
  const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const cached = holidayCache.get(iso);
  if (cached !== undefined) return cached;
  const result = italyHolidays.isHoliday(iso);
  let isPublic: boolean;
  if (!Array.isArray(result)) {
    // Backwards-compat: older date-holidays versions return a single object or false
    isPublic = result !== false && (result as { type?: string }).type === "public";
  } else {
    isPublic = result.some((h) => h.type === "public");
  }
  holidayCache.set(iso, isPublic);
  return isPublic;
}

export interface BuildMatrixParams {
  target: SeriesPoint[];
  drivers: Record<string, SeriesPoint[]>;
  meteoForecast: SeriesPoint[] | null;
  horizonDays: number;
}

export interface FeatureMatrix {
  X: number[][];
  y: number[];
  featureNames: string[];
  dates: Date[];
}

const LAGS_TARGET = [1, 7, 30];
const LAGS_DRIVER = [1, 7];

export function buildFeatureMatrix(p: BuildMatrixParams): FeatureMatrix {
  const { target, drivers, horizonDays } = p;
  const n = target.length;
  const values = target.map((s) => s.value);
  const tLag = buildLagFeatures(target, LAGS_TARGET);
  const tMean7 = rollingMean(values, 7);
  const tMean30 = rollingMean(values, 30);
  const tStd30 = rollingStd(values, 30);
  const driverLags: Record<string, Record<string, number | null>[]> = {};
  for (const [name, series] of Object.entries(drivers)) {
    driverLags[name] = buildLagFeatures(series, LAGS_DRIVER);
  }
  const driverNames = Object.keys(drivers);

  const X: number[][] = [];
  const y: number[] = [];
  const dates: Date[] = [];
  const featureNames: string[] = [
    ...LAGS_TARGET.map((l) => `target_lag_${l}`),
    "target_mean_7",
    "target_mean_30",
    "target_std_30",
    ...driverNames.flatMap((dn) => LAGS_DRIVER.map((l) => `${dn}_lag_${l}`)),
    "hdd_lag1",
    "cdd_lag1",
    ...Array.from({ length: 7 }, (_, i) => `dow_${i}`),
    ...Array.from({ length: 12 }, (_, i) => `month_${i + 1}`),
    "is_holiday",
    "sin_year",
    "cos_year",
    "sin_week",
    "cos_week",
  ];

  const maxLag = Math.max(...LAGS_TARGET, ...LAGS_DRIVER, 30);
  for (let i = maxLag; i + horizonDays < n; i++) {
    const row: number[] = [];
    let valid = true;

    for (const l of LAGS_TARGET) {
      const v = tLag[i][`lag_${l}`];
      if (v === null) {
        valid = false;
        break;
      }
      row.push(v);
    }
    if (!valid) continue;

    row.push(tMean7[i] ?? Number.NaN, tMean30[i] ?? Number.NaN, tStd30[i] ?? Number.NaN);

    for (const dn of driverNames) {
      for (const l of LAGS_DRIVER) {
        const lagsForDriverAtI = driverLags[dn][i];
        if (!lagsForDriverAtI) {
          valid = false;
          break;
        }
        const v = lagsForDriverAtI[`lag_${l}`];
        if (v === null || !Number.isFinite(v)) {
          valid = false;
          break;
        }
        row.push(v);
      }
      if (!valid) break;
    }
    if (!valid) continue;

    const tempSeries = drivers[TEMPERATURE_DRIVER_KEY];
    const tempLag1 = tempSeries && i >= 1 ? tempSeries[i - 1].value : null;
    if (tempLag1 === null) continue;
    row.push(computeHDD(tempLag1), computeCDD(tempLag1));

    const today = target[i].date;
    const dow = dayOfWeekOneHot(today);
    for (let k = 0; k < 7; k++) row.push(dow[`dow_${k}`]);
    const mo = monthOneHot(today);
    for (let k = 1; k <= 12; k++) row.push(mo[`month_${k}`]);
    row.push(isItalianHoliday(today) ? 1 : 0);

    const cyc = seasonalCyclic(today);
    row.push(cyc.sin_year, cyc.cos_year, cyc.sin_week, cyc.cos_week);

    if (row.some((v) => !Number.isFinite(v))) continue;

    X.push(row);
    y.push(target[i + horizonDays].value);
    dates.push(target[i + horizonDays].date);
  }

  return { X, y, featureNames, dates };
}

/**
 * Costruisce SOLO la riga di feature per l'ultima osservazione disponibile.
 * Usata in inferenza: target[t] e' "oggi", prediciamo target[t+h].
 * Ritorna { row, featureNames } o null se non ci sono abbastanza dati storici.
 */
export function buildLatestFeatureRow(
  p: Omit<BuildMatrixParams, "horizonDays">,
): { row: number[]; featureNames: string[]; date: Date } | null {
  const fake = buildFeatureMatrix({ ...p, horizonDays: 0 });
  if (fake.X.length === 0) return null;
  return {
    row: fake.X[fake.X.length - 1],
    featureNames: fake.featureNames,
    date: fake.dates[fake.dates.length - 1],
  };
}
