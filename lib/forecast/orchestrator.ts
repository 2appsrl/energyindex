/**
 * Orchestrator del forecast: dato un asset target + i suoi driver + un horizon,
 * costruisce features, addestra Ridge, predice il valore a t+h, calcola
 * banda conformal e driver attribution.
 *
 * Pure function: nessun I/O. Chi chiama (script ETL, backfill) si occupa di
 * caricare le serie da Supabase e di salvare il risultato.
 */
import {
  buildFeatureMatrix,
  buildLatestFeatureRow,
  TEMPERATURE_DRIVER_KEY,
  type SeriesPoint,
} from "./features";
import { trainRidge, predictRidge, calibrateConformal } from "./model";
import { computeAttribution, type DriverContribution } from "./attribution";

export const MODEL_VERSION = "ridge-v1.0";
const RIDGE_LAMBDA = 1.0;
const CALIB_WINDOW = 90;
const CONFORMAL_ALPHA = 0.9;
const ATTRIBUTION_TOP_K = 4;
const MIN_TRAINING_ROWS = 60;

export interface ForecastInput {
  assetSlug: string;
  horizonDays: number;          // 7/30/90/180
  target: SeriesPoint[];        // serie del target ordinata cronologica
  drivers: Record<string, SeriesPoint[]>;
  generatedAt: Date;            // tipicamente NOW() o data simulata per backfill
}

export interface ForecastOutput {
  asset_slug: string;
  forecast_date: string;        // YYYY-MM-DD
  generated_at: string;         // ISO
  horizon_days: number;
  value: number;
  value_lower: number;
  value_upper: number;
  drivers: DriverContribution[];
  model_version: string;
}

export function generateForecastForAsset(input: ForecastInput): ForecastOutput | null {
  const { target, drivers, horizonDays, generatedAt, assetSlug } = input;

  // 1) Costruisci matrice training
  const { X, y, featureNames } = buildFeatureMatrix({
    target,
    drivers,
    meteoForecast: null,
    horizonDays,
  });
  if (X.length < MIN_TRAINING_ROWS) return null;

  // 2) Split train/calib: ultimi CALIB_WINDOW per conformal, resto per train
  const calibStart = Math.max(0, X.length - CALIB_WINDOW);
  const XTrain = X.slice(0, calibStart);
  const yTrain = y.slice(0, calibStart);
  const XCalib = X.slice(calibStart);
  const yCalib = y.slice(calibStart);
  if (XTrain.length < MIN_TRAINING_ROWS) return null;

  // 3) Addestra Ridge sul train
  const model = trainRidge(XTrain, yTrain, RIDGE_LAMBDA);

  // 4) Calibra banda conformal sui residui del calib set
  const conformalQ = calibrateConformal(model, XCalib, yCalib, CONFORMAL_ALPHA);

  // 5) Build feature row di "oggi" e predict
  const latest = buildLatestFeatureRow({ target, drivers, meteoForecast: null });
  if (!latest) return null;
  const value = predictRidge(model, latest.row);

  // 6) Driver attribution
  // featureMeansTraining: medie del training (X non standardizzato). Le abbiamo
  // gia' in model.featureMeans (lo standardizer le ha calcolate).
  const driversAttr = computeAttribution(
    {
      featureNames,
      coefficients: model.coefficients,
      featureRow: latest.row,
      featureMeansTraining: model.featureMeans,
    },
    ATTRIBUTION_TOP_K,
  );

  // 7) forecast_date = generatedAt.date + horizonDays
  const fcDate = new Date(generatedAt);
  fcDate.setUTCDate(fcDate.getUTCDate() + horizonDays);
  const forecastDateStr = fcDate.toISOString().slice(0, 10);

  return {
    asset_slug: assetSlug,
    forecast_date: forecastDateStr,
    generated_at: generatedAt.toISOString(),
    horizon_days: horizonDays,
    value: Math.round(value * 10000) / 10000,
    value_lower: Math.round((value - conformalQ) * 10000) / 10000,
    value_upper: Math.round((value + conformalQ) * 10000) / 10000,
    drivers: driversAttr,
    model_version: MODEL_VERSION,
  };
}

export { TEMPERATURE_DRIVER_KEY };
