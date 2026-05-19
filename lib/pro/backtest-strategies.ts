/**
 * Backtest Engine — strategy presets.
 *
 * Quattro strategie pre-confezionate per il backtest demo:
 *  1. Mean Reversion PUN (unlocked: default demo)
 *  2. Momentum Breakout PUN (locked)
 *  3. Spark Spread Arb PUN-PSV-CO2 (locked)
 *  4. Seasonality PUN (locked)
 *
 * Ogni strategia espone `signalFn(series, extras, params) -> Position[]`. Le
 * funzioni sono pure: stesso input -> stesso output, niente I/O.
 */

import type { Position, PricePoint } from "./backtest-math";

export type StrategyId =
  | "mean-reversion-pun"
  | "momentum-breakout-pun"
  | "spark-spread-arb"
  | "seasonality-pun";

export type AssetSlug = "pun" | "psv" | "ttf";
export type ExtraSlug = "psv" | "co2";

export interface Strategy {
  id: StrategyId;
  name: string;
  shortLabel: string;
  description: string;
  /** false = sbloccata in demo, true = teaser locked con CTA upgrade */
  locked: boolean;
  /** asset principale su cui opera (serie passata come `series` a signalFn) */
  asset: AssetSlug;
  /** asset addizionali richiesti via `extras` (es. PSV+CO2 per spark spread) */
  needsAlso?: ExtraSlug[];
  /** parametri fissati nel demo (non tweakable) */
  params: Record<string, number>;
  signalFn: (
    series: PricePoint[],
    extras: Record<string, PricePoint[]>,
    params: Record<string, number>,
  ) => Position[];
}

// ============================================================
// STRATEGY 1: Mean Reversion (unlocked demo default)
// ============================================================

/**
 * Z-score mean reversion: long quando il prezzo e' N std sotto la media mobile,
 * short quando e' N std sopra. Exit quando z-score rientra entro `exitThreshold`.
 *
 * Stateful: mantiene la posizione finche' non scatta condizione di exit.
 */
function meanReversionSignals(
  series: PricePoint[],
  _extras: Record<string, PricePoint[]>,
  params: Record<string, number>,
): Position[] {
  const window = Math.max(2, Math.floor(params.window ?? 20));
  const entryThreshold = params.entryThreshold ?? 1.5;
  const exitThreshold = params.exitThreshold ?? 0.25;

  const signals: Position[] = [];
  let position: Position = 0;

  for (let i = 0; i < series.length; i++) {
    if (i < window) {
      signals.push(0);
      continue;
    }
    const w = series.slice(i - window, i).map((p) => p.close);
    const mean = w.reduce((a, b) => a + b, 0) / window;
    const variance = w.reduce((a, b) => a + (b - mean) ** 2, 0) / window;
    const std = Math.sqrt(variance);
    if (std === 0 || !Number.isFinite(std)) {
      signals.push(position);
      continue;
    }
    const z = (series[i].close - mean) / std;
    if (position === 0) {
      if (z < -entryThreshold) position = 1;
      else if (z > entryThreshold) position = -1;
    } else if (position === 1 && z >= -exitThreshold) {
      position = 0;
    } else if (position === -1 && z <= exitThreshold) {
      position = 0;
    }
    signals.push(position);
  }
  return signals;
}

// ============================================================
// STRATEGY 2: Momentum Breakout (Donchian)
// ============================================================

/**
 * Long su rottura N-day high, exit su chiusura sotto M-day low. Pattern Donchian
 * classico, no shorting (mercato spot solo long in demo).
 */
function momentumBreakoutSignals(
  series: PricePoint[],
  _extras: Record<string, PricePoint[]>,
  params: Record<string, number>,
): Position[] {
  const breakoutWindow = Math.max(2, Math.floor(params.breakoutWindow ?? 20));
  const exitWindow = Math.max(2, Math.floor(params.exitWindow ?? 10));

  const signals: Position[] = [];
  let position: Position = 0;

  for (let i = 0; i < series.length; i++) {
    if (i < breakoutWindow) {
      signals.push(0);
      continue;
    }
    const highWin = series.slice(i - breakoutWindow, i).map((p) => p.close);
    const lowWin = series.slice(Math.max(0, i - exitWindow), i).map((p) => p.close);
    const high = Math.max(...highWin);
    const low = Math.min(...lowWin);
    if (position === 0 && series[i].close > high) {
      position = 1;
    } else if (position === 1 && series[i].close < low) {
      position = 0;
    }
    signals.push(position);
  }
  return signals;
}

// ============================================================
// STRATEGY 3: Spark Spread Arbitrage
// ============================================================

/**
 * Trade lo spark spread implicito (PUN − 1.8·PSV − 0.35·CO2) vs percentili
 * storici. Long quando spread e' nei percentili bassi (centrale fuori dai
 * margini, attendiamo ritorno alla media), short quando ai percentili alti.
 * Exit quando torna alla mediana.
 *
 * Richiede PSV + CO2 come serie addizionali.
 */
function sparkSpreadSignals(
  series: PricePoint[],
  extras: Record<string, PricePoint[]>,
  params: Record<string, number>,
): Position[] {
  const window = Math.max(10, Math.floor(params.window ?? 90));
  const entryPct = params.entryPct ?? 0.1; // <= 10° e >= 90° percentile

  const psvMap = new Map((extras.psv ?? []).map((p) => [p.date, p.close]));
  const co2Map = new Map((extras.co2 ?? []).map((p) => [p.date, p.close]));

  // Spark spread per ogni giorno (NaN se manca PSV o CO2 quel giorno)
  const sparks: number[] = series.map((p) => {
    const ps = psvMap.get(p.date);
    const co = co2Map.get(p.date);
    if (ps === undefined || co === undefined) return NaN;
    return p.close - 1.8 * ps - 0.35 * co;
  });

  const signals: Position[] = [];
  let position: Position = 0;

  for (let i = 0; i < series.length; i++) {
    if (i < window) {
      signals.push(0);
      continue;
    }
    const w = sparks
      .slice(i - window, i)
      .filter((x) => Number.isFinite(x))
      .sort((a, b) => a - b);
    if (w.length < 10) {
      signals.push(position);
      continue;
    }
    const lo = w[Math.floor(w.length * entryPct)];
    const hi = w[Math.floor(w.length * (1 - entryPct))];
    const mid = w[Math.floor(w.length / 2)];
    const curr = sparks[i];
    if (!Number.isFinite(curr)) {
      signals.push(position);
      continue;
    }
    if (position === 0) {
      if (curr < lo) position = 1;
      else if (curr > hi) position = -1;
    } else if (position === 1 && curr >= mid) {
      position = 0;
    } else if (position === -1 && curr <= mid) {
      position = 0;
    }
    signals.push(position);
  }
  return signals;
}

// ============================================================
// STRATEGY 4: Seasonality
// ============================================================

/**
 * Long da settembre a febbraio (mesi 9..12, 1, 2 — winter peak italiano),
 * flat altrove. Strategia pura calendaristica, nessun parametro tweakable
 * oltre i mesi di inizio/fine.
 */
function seasonalitySignals(
  series: PricePoint[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _extras: Record<string, PricePoint[]>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _params: Record<string, number>,
): Position[] {
  return series.map((p) => {
    const month = Number.parseInt(p.date.slice(5, 7), 10);
    if (Number.isNaN(month)) return 0 as Position;
    return month >= 9 || month <= 2 ? (1 as Position) : (0 as Position);
  });
}

// ============================================================
// REGISTRY
// ============================================================

export const STRATEGIES: Strategy[] = [
  {
    id: "mean-reversion-pun",
    name: "Mean Reversion PUN",
    shortLabel: "Mean Reversion",
    description:
      "Long quando PUN e' 1.5σ sotto la media mobile a 20 giorni, short quando 1.5σ sopra. Exit a rientro nel range. Pattern statistico classico, efficace su mercati che oscillano intorno a un fair value.",
    locked: false,
    asset: "pun",
    params: { window: 20, entryThreshold: 1.5, exitThreshold: 0.25 },
    signalFn: meanReversionSignals,
  },
  {
    id: "momentum-breakout-pun",
    name: "Momentum Breakout PUN",
    shortLabel: "Momentum",
    description:
      "Long su rottura del massimo a 20 giorni, exit su chiusura sotto il minimo a 10 giorni (Donchian channel). Cattura i trend direzionali, sottoperforma su mercato laterale.",
    locked: true,
    asset: "pun",
    params: { breakoutWindow: 20, exitWindow: 10 },
    signalFn: momentumBreakoutSignals,
  },
  {
    id: "spark-spread-arb",
    name: "Spark Spread Arb",
    shortLabel: "Spark Arb",
    description:
      "Trade lo spark spread implicito PUN − 1.8·PSV − 0.35·CO2 vs percentili a 90 giorni. Long quando lo spread e' sotto il 10° percentile (centrale CCGT fuori dai margini -> attesa ripresa), short sopra il 90° percentile. Necessita PSV + CO2.",
    locked: true,
    asset: "pun",
    needsAlso: ["psv", "co2"],
    params: { window: 90, entryPct: 0.1 },
    signalFn: sparkSpreadSignals,
  },
  {
    id: "seasonality-pun",
    name: "Seasonality PUN",
    shortLabel: "Seasonality",
    description:
      "Long da settembre a febbraio (winter peak italiano), flat marzo-agosto. Strategia pura calendaristica basata sul pattern stagionale storico del consumo elettrico in Italia.",
    locked: true,
    asset: "pun",
    params: { longStartMonth: 9, longEndMonth: 2 },
    signalFn: seasonalitySignals,
  },
];

export function getStrategy(id: StrategyId): Strategy | undefined {
  return STRATEGIES.find((s) => s.id === id);
}
