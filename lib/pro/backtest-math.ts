/**
 * Backtest Engine — pure math.
 *
 * Walk-forward simulator: dato una serie di prezzi (close-to-close) e una
 * sequenza di posizioni target (-1 short / 0 flat / +1 long), calcola:
 *  - equity curve (P&L cumulato in EUR su contratto da 1 MWh)
 *  - lista trade (apertura, chiusura, P&L, durata)
 *  - metriche: Sharpe annualizzato, max drawdown, win rate, profit factor, return totale
 *
 * Convenzione no look-ahead bias:
 *  signals[i] = posizione decisa alla chiusura del giorno i, tenuta fino
 *  alla chiusura del giorno i+1. P&L del giorno i+1 = (close[i+1] − close[i]) × signals[i].
 *
 * Niente I/O, niente React, niente DB. Tutto testabile in isolamento.
 */

export type Position = -1 | 0 | 1;

export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

export interface Trade {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  side: "long" | "short";
  pnlEur: number; // su sizeMwh = 1 di default
  pnlPct: number; // return % vs entry price
  durationDays: number;
}

export interface EquityPoint {
  date: string;
  equity: number; // cumP&L EUR
  drawdownEur: number; // peak − equity, sempre >= 0
}

export interface BacktestMetrics {
  sharpe: number; // annualizzato, periodi/anno = 252
  maxDrawdownEur: number; // assoluto
  maxDrawdownPct: number; // 0..1 vs peak (0 se peak <= 0)
  winRate: number; // 0..1
  numTrades: number;
  avgPnlEur: number;
  profitFactor: number; // grossProfit / grossLoss (Infinity se loss=0 e profit>0)
  totalReturnEur: number;
  totalReturnPct: number; // vs baseline (primo close × sizeMwh)
}

export interface BacktestResult {
  trades: Trade[];
  equityCurve: EquityPoint[];
  metrics: BacktestMetrics;
}

const EMPTY_METRICS: BacktestMetrics = {
  sharpe: 0,
  maxDrawdownEur: 0,
  maxDrawdownPct: 0,
  winRate: 0,
  numTrades: 0,
  avgPnlEur: 0,
  profitFactor: 0,
  totalReturnEur: 0,
  totalReturnPct: 0,
};

/**
 * Esegue il walk-forward dato `series` e `signals` (devono avere stesso indice
 * temporale). `sizeMwh` di default 1 (un MWh per contratto). Restituisce la
 * lista trade, l'equity curve e le metriche aggregate.
 */
export function simulate(
  series: PricePoint[],
  signals: Position[],
  sizeMwh = 1,
): BacktestResult {
  const n = Math.min(series.length, signals.length);
  if (n < 2) {
    return { trades: [], equityCurve: [], metrics: EMPTY_METRICS };
  }

  const trades: Trade[] = [];
  let open: { idx: number; date: string; price: number; side: "long" | "short" } | null = null;

  let cumPnl = 0;
  let peak = 0;
  const equityCurve: EquityPoint[] = [{ date: series[0].date, equity: 0, drawdownEur: 0 }];

  for (let i = 1; i < n; i++) {
    const prevPos = signals[i - 1] ?? 0;
    const dailyPnl = (series[i].close - series[i - 1].close) * prevPos * sizeMwh;
    cumPnl += dailyPnl;
    if (cumPnl > peak) peak = cumPnl;
    equityCurve.push({
      date: series[i].date,
      equity: cumPnl,
      drawdownEur: Math.max(0, peak - cumPnl),
    });

    const currPos = signals[i] ?? 0;

    // Trade boundary detection on transition
    if (prevPos === 0 && currPos !== 0) {
      // OPEN
      open = {
        idx: i,
        date: series[i].date,
        price: series[i].close,
        side: currPos === 1 ? "long" : "short",
      };
    } else if (prevPos !== 0 && currPos === 0 && open) {
      // CLOSE
      trades.push(closeTrade(open, series[i], i, sizeMwh));
      open = null;
    } else if (prevPos !== 0 && currPos !== 0 && prevPos !== currPos && open) {
      // FLIP: close old, open new
      trades.push(closeTrade(open, series[i], i, sizeMwh));
      open = {
        idx: i,
        date: series[i].date,
        price: series[i].close,
        side: currPos === 1 ? "long" : "short",
      };
    }
  }

  // Chiudi posizione aperta a fine serie (mark-to-market all'ultimo close)
  if (open) {
    trades.push(closeTrade(open, series[n - 1], n - 1, sizeMwh));
  }

  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push(equityCurve[i].equity - equityCurve[i - 1].equity);
  }

  const sharpe = computeSharpe(returns);
  const dd = computeMaxDrawdown(equityCurve.map((p) => p.equity));
  const wins = trades.filter((t) => t.pnlEur > 0);
  const losses = trades.filter((t) => t.pnlEur < 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnlEur, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlEur, 0));
  const baseline = series[0].close * sizeMwh;

  const metrics: BacktestMetrics = {
    sharpe,
    maxDrawdownEur: dd.value,
    maxDrawdownPct: dd.pct,
    winRate: trades.length > 0 ? wins.length / trades.length : 0,
    numTrades: trades.length,
    avgPnlEur: trades.length > 0 ? cumPnl / trades.length : 0,
    profitFactor:
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : 0,
    totalReturnEur: cumPnl,
    totalReturnPct: baseline > 0 ? cumPnl / baseline : 0,
  };

  return { trades, equityCurve, metrics };
}

function closeTrade(
  open: { idx: number; date: string; price: number; side: "long" | "short" },
  exit: PricePoint,
  exitIdx: number,
  sizeMwh: number,
): Trade {
  const direction = open.side === "long" ? 1 : -1;
  const pnlEur = (exit.close - open.price) * direction * sizeMwh;
  const pnlPct = open.price !== 0 ? pnlEur / (open.price * sizeMwh) : 0;
  return {
    entryDate: open.date,
    entryPrice: open.price,
    exitDate: exit.date,
    exitPrice: exit.close,
    side: open.side,
    pnlEur,
    pnlPct,
    durationDays: exitIdx - open.idx,
  };
}

/**
 * Sharpe ratio annualizzato. `periodsPerYear` default 252 (giorni di trading).
 * Ritorna 0 se la serie e' vuota o ha varianza zero.
 */
export function computeSharpe(returns: number[], periodsPerYear = 252): number {
  if (returns.length === 0) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(returns.length - 1, 1);
  const std = Math.sqrt(variance);
  if (std === 0 || !Number.isFinite(std)) return 0;
  return (mean / std) * Math.sqrt(periodsPerYear);
}

/**
 * Max drawdown peak-to-trough sulla equity curve. Restituisce valore assoluto
 * (EUR) e percentuale (vs peak; 0 se peak <= 0).
 */
export function computeMaxDrawdown(equity: number[]): {
  value: number;
  pct: number;
  peakIdx: number;
  troughIdx: number;
} {
  if (equity.length === 0) {
    return { value: 0, pct: 0, peakIdx: 0, troughIdx: 0 };
  }
  let peak = equity[0];
  let peakIdx = 0;
  let resultValue = 0;
  let resultPct = 0;
  let resultPeak = 0;
  let resultTrough = 0;
  for (let i = 0; i < equity.length; i++) {
    if (equity[i] > peak) {
      peak = equity[i];
      peakIdx = i;
    }
    const dd = peak - equity[i];
    if (dd > resultValue) {
      resultValue = dd;
      resultPct = peak > 0 ? dd / peak : 0;
      resultPeak = peakIdx;
      resultTrough = i;
    }
  }
  return { value: resultValue, pct: resultPct, peakIdx: resultPeak, troughIdx: resultTrough };
}
