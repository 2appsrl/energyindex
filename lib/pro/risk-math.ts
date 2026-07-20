/**
 * Risk & Hedging math: marca-to-market, VaR parametrico, stress test e hedge
 * ratio per il portafoglio open positions del trader desk.
 *
 * Pure functions, no I/O, testabili.
 */

export type Side = "BUY" | "SELL";
export type AssetSlug = "pun" | "psv" | "ttf";

export interface Position {
  id: string;
  asset: AssetSlug;
  side: Side;
  volumeMwh: number;
  executedPriceEurPerMwh: number;
  deliveryMonth: string; // "YYYY-MM"
}

export interface ForecastByAsset {
  pun: number; // EUR/MWh forecast atteso per delivery
  psv: number;
  ttf: number;
}

export interface AtrPctByAsset {
  pun: number; // ATR / spot, es. 0.04 = 4% giornaliero
  psv: number;
  ttf: number;
}

export interface PositionMtm {
  position: Position;
  forecastPriceEurPerMwh: number;
  mtmEur: number;
  hedgeRatio: number; // 0..0.9 suggested
}

/**
 * Marca-to-market di una singola posizione vs forecast atteso per il delivery.
 *   MtM = (forecast - executed) * volume * side_factor
 * BUY (long): profitto se forecast > executed. SELL: profitto se forecast <
 * executed.
 *
 * Hedge ratio: piu' tempo a delivery + piu' volatility -> piu' hedge.
 * Calibrazione: 4% vol giornaliero * 90g time factor 1.0 * 10 = 3.6 -> clamp
 * 0.9 (max 90% del volume).
 */
export function computePositionMtm(
  p: Position,
  fc: ForecastByAsset,
  atrPct: AtrPctByAsset,
  daysToDelivery: number,
): PositionMtm {
  const sideFactor = p.side === "BUY" ? 1 : -1;
  const forecastPrice = fc[p.asset];
  const mtm = (forecastPrice - p.executedPriceEurPerMwh) * p.volumeMwh * sideFactor;

  const timeFactor = Math.min(1, daysToDelivery / 90);
  const vol = atrPct[p.asset];
  const rawRatio = vol * timeFactor * 10;
  const hedgeRatio = Math.max(0, Math.min(0.9, rawRatio));

  return { position: p, forecastPriceEurPerMwh: forecastPrice, mtmEur: mtm, hedgeRatio };
}

export interface PortfolioSummary {
  totalExposureEur: number;
  netMtmEur: number;
  totalVolumeMwh: number;
  avgMarginEurPerMwh: number;
  byAsset: Record<AssetSlug, { volume: number; mtm: number; exposure: number }>;
}

/**
 * Aggrega MtM e esposizione su tutto il portafoglio + breakdown per asset.
 * Esposizione = somma assoluta di |price * volume| (gross, non netta tra
 * long/short).
 */
export function computePortfolioSummary(mtms: PositionMtm[]): PortfolioSummary {
  let totalExposure = 0;
  let netMtm = 0;
  let totalVolume = 0;
  const byAsset = {
    pun: { volume: 0, mtm: 0, exposure: 0 },
    psv: { volume: 0, mtm: 0, exposure: 0 },
    ttf: { volume: 0, mtm: 0, exposure: 0 },
  } as PortfolioSummary["byAsset"];

  for (const m of mtms) {
    const p = m.position;
    const exposure = Math.abs(p.executedPriceEurPerMwh * p.volumeMwh);
    totalExposure += exposure;
    netMtm += m.mtmEur;
    totalVolume += p.volumeMwh;
    byAsset[p.asset].volume += p.volumeMwh;
    byAsset[p.asset].mtm += m.mtmEur;
    byAsset[p.asset].exposure += exposure;
  }

  return {
    totalExposureEur: totalExposure,
    netMtmEur: netMtm,
    totalVolumeMwh: totalVolume,
    avgMarginEurPerMwh: totalVolume > 0 ? netMtm / totalVolume : 0,
    byAsset,
  };
}

export interface VaRMetrics {
  var1d95: number;
  var1d99: number;
  var10d95: number;
  var10d99: number;
  portfolioVolatilityPct: number;
}

/**
 * VaR parametrico semplificato (per demo, NON production-grade).
 * Assume distribuzione normale dei rendimenti. Per uso reale servirebbe
 * historical simulation o Monte Carlo + correlation aggiustamenti.
 *
 *   VaR_1g_95 = 1.645 * exposure * volatility_pct
 *   VaR_1g_99 = 2.326 * exposure * volatility_pct
 *   VaR_10g   = VaR_1g * sqrt(10)
 *
 * volatility_pct = media pesata per esposizione delle ATR% per asset.
 */
export function computeVaR(summary: PortfolioSummary, atrPct: AtrPctByAsset): VaRMetrics {
  if (summary.totalExposureEur === 0) {
    return { var1d95: 0, var1d99: 0, var10d95: 0, var10d99: 0, portfolioVolatilityPct: 0 };
  }
  let weightedVol = 0;
  for (const slug of ["pun", "psv", "ttf"] as const) {
    const exp = summary.byAsset[slug].exposure;
    const w = exp / summary.totalExposureEur;
    weightedVol += w * atrPct[slug];
  }
  const var1d95 = 1.645 * summary.totalExposureEur * weightedVol;
  const var1d99 = 2.326 * summary.totalExposureEur * weightedVol;
  const sqrt10 = Math.sqrt(10);
  return {
    var1d95,
    var1d99,
    var10d95: var1d95 * sqrt10,
    var10d99: var1d99 * sqrt10,
    portfolioVolatilityPct: weightedVol,
  };
}

export interface StressScenario {
  id: string;
  label: string;
  shocks: { pun: number; psv: number; ttf: number }; // % moltiplicativi (es. 0.15 = +15%)
}

export const STRESS_SCENARIOS: StressScenario[] = [
  { id: "ttf_up_30", label: "TTF +30% (crisi gas)", shocks: { pun: 0.15, psv: 0.28, ttf: 0.3 } },
  {
    id: "ttf_down_20",
    label: "TTF −20% (gas a sconto)",
    shocks: { pun: -0.1, psv: -0.19, ttf: -0.2 },
  },
  {
    id: "cold",
    label: "Inverno freddo +consumo gas",
    shocks: { pun: 0.08, psv: 0.12, ttf: 0.05 },
  },
  {
    id: "heat",
    label: "Ondata di calore +consumo el",
    shocks: { pun: 0.12, psv: 0.03, ttf: 0.02 },
  },
  { id: "recession", label: "Recessione domanda", shocks: { pun: -0.07, psv: -0.05, ttf: -0.03 } },
];

export interface StressResult {
  scenario: StressScenario;
  deltaPnlEur: number;
  newNetMtmEur: number;
  pctOfExposure: number;
}

/**
 * Applica uno shock % multiplicativo al forecast e ricalcola MtM netto del
 * portafoglio. Ritorna delta vs baseline + % di esposizione totale.
 */
export function computeStressTest(
  mtms: PositionMtm[],
  baseline: PortfolioSummary,
  scenario: StressScenario,
  fc: ForecastByAsset,
): StressResult {
  const stressedFc: ForecastByAsset = {
    pun: fc.pun * (1 + scenario.shocks.pun),
    psv: fc.psv * (1 + scenario.shocks.psv),
    ttf: fc.ttf * (1 + scenario.shocks.ttf),
  };
  let stressedNetMtm = 0;
  for (const m of mtms) {
    const p = m.position;
    const sideFactor = p.side === "BUY" ? 1 : -1;
    stressedNetMtm += (stressedFc[p.asset] - p.executedPriceEurPerMwh) * p.volumeMwh * sideFactor;
  }
  const delta = stressedNetMtm - baseline.netMtmEur;
  return {
    scenario,
    deltaPnlEur: delta,
    newNetMtmEur: stressedNetMtm,
    pctOfExposure: baseline.totalExposureEur > 0 ? delta / baseline.totalExposureEur : 0,
  };
}

/**
 * Giorni tra oggi e il 15 del mese di delivery (mid-month come convenzione).
 * Clamp a 0 se delivery passato.
 */
export function daysToDelivery(deliveryMonth: string, today: Date = new Date()): number {
  const [y, m] = deliveryMonth.split("-").map(Number);
  if (!y || !m) return 30;
  const delivery = new Date(Date.UTC(y, m - 1, 15));
  return Math.max(0, Math.ceil((delivery.getTime() - today.getTime()) / 86400000));
}

/**
 * Forecast horizons disponibili nel sistema: 7, 30, 90, 180 giorni.
 * Mappa days-to-delivery al horizon piu' vicino:
 *   <=18g  -> 7
 *   <=60g  -> 30
 *   <=135g -> 90
 *   >135g  -> 180
 */
export function nearestForecastHorizon(days: number): 7 | 30 | 90 | 180 {
  if (days <= 18) return 7;
  if (days <= 60) return 30;
  if (days <= 135) return 90;
  return 180;
}
