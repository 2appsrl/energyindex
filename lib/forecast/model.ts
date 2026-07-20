/**
 * Ridge regression + split conformal prediction.
 *
 * Ridge: beta = (X^T X + lambda I)^-1 X^T y, con standardizzazione delle feature.
 * Conformal: banda di confidenza non-parametrica via quantile dei residui assoluti.
 *
 * Dimensioni tipiche: ~1500 osservazioni, ~35 feature => matrici piccole, in-memory.
 * Tempo training: <100ms su laptop moderno.
 */
import { Matrix, solve } from "ml-matrix";

export interface RidgeModel {
  coefficients: number[];     // shape: [n_features]
  intercept: number;
  featureMeans: number[];     // per riscalare in inferenza
  featureStds: number[];
  lambda: number;
}

/**
 * Training Ridge. Standardizza X (zero-mean, unit-std), centra y, risolve
 * sistema normale `(X'X + lambda I) beta = X' y`. Intercept = mean(y) (su y centrato e' 0).
 *
 * @param X matrice [n][p] (righe = osservazioni, colonne = feature)
 * @param y vettore [n] target
 * @param lambda regolarizzazione L2 (>0)
 */
export function trainRidge(X: number[][], y: number[], lambda: number): RidgeModel {
  if (X.length === 0) throw new Error("trainRidge: empty training set");
  if (X.length !== y.length) throw new Error("trainRidge: X.length !== y.length");
  const n = X.length;
  const p = X[0].length;

  // 1. Standardizzazione feature
  const means: number[] = new Array(p).fill(0);
  for (const row of X) for (let j = 0; j < p; j++) means[j] += row[j] / n;
  const stds: number[] = new Array(p).fill(0);
  for (const row of X)
    for (let j = 0; j < p; j++) stds[j] += (row[j] - means[j]) ** 2 / n;
  for (let j = 0; j < p; j++) stds[j] = Math.sqrt(stds[j]) || 1; // evita /0

  const Xs = X.map((row) => row.map((v, j) => (v - means[j]) / stds[j]));
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const yc = y.map((v) => v - yMean);

  // 2. Risolvi (X'X + lambda I) beta = X' y
  const Xm = new Matrix(Xs);
  const XtX = Xm.transpose().mmul(Xm);
  const reg = Matrix.eye(p).mul(lambda);
  const A = XtX.add(reg);
  const Xty = Xm.transpose().mmul(Matrix.columnVector(yc));
  const betaStd = solve(A, Xty); // beta nello spazio standardizzato

  // 3. Riporta i coefficient nello spazio originale: beta_orig[j] = beta_std[j] / std[j]
  const coefficients = new Array(p).fill(0);
  for (let j = 0; j < p; j++) coefficients[j] = betaStd.get(j, 0) / stds[j];
  // intercept_orig = yMean - sum(coef * mean)
  let intercept = yMean;
  for (let j = 0; j < p; j++) intercept -= coefficients[j] * means[j];

  return { coefficients, intercept, featureMeans: means, featureStds: stds, lambda };
}

export function predictRidge(model: RidgeModel, x: number[]): number {
  if (x.length !== model.coefficients.length)
    throw new Error(`predictRidge: dim mismatch ${x.length} vs ${model.coefficients.length}`);
  let acc = model.intercept;
  for (let j = 0; j < x.length; j++) acc += model.coefficients[j] * x[j];
  return acc;
}

/**
 * Quantile q dei residui assoluti.
 * Banda conformal: prediction ± conformalQuantile(residuals, 0.9).
 * Garanzia teorica: il valore reale cade dentro la banda con probabilita' ~q (distribution-free).
 */
export function conformalQuantile(residuals: number[], q: number): number {
  if (residuals.length === 0) return 0;
  const abs = residuals.map(Math.abs).sort((a, b) => a - b);
  const idx = Math.min(abs.length - 1, Math.floor(q * (abs.length + 1)) - 1);
  return abs[Math.max(0, idx)];
}

/**
 * Calibra la banda conformal su un set di calibrazione (ultimi N giorni).
 * residuals[i] = y_true[i] - predictRidge(model, X_calib[i]).
 */
export function calibrateConformal(
  model: RidgeModel,
  XCalib: number[][],
  yCalib: number[],
  alpha = 0.9,
): number {
  const residuals: number[] = [];
  for (let i = 0; i < XCalib.length; i++) {
    residuals.push(yCalib[i] - predictRidge(model, XCalib[i]));
  }
  return conformalQuantile(residuals, alpha);
}
