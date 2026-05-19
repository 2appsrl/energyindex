/**
 * Trading Vitals math: indicatori derivati dai prezzi spot italiani.
 * Pure functions, no I/O, testabili.
 */

export interface DailyObservation {
  date: string; // YYYY-MM-DD
  value: number;
}

// ============================================
// 1. SPARK SPREAD ITALIA
// ============================================

/**
 * Calcola lo Spark Spread per una centrale CCGT italiana.
 *
 *   spark_spread = PUN - (PSV * heat_rate_gas) - (CO2 * emission_factor)
 *
 * Default heat_rate_gas = 1.8 MWh gas / MWh elettrico (CCGT moderno).
 * Default emission_factor = 0.35 tCO2 / MWh elettrico (gas naturale).
 *
 * Tutti i prezzi devono essere in EUR/MWh.
 *   - PUN: gia' EUR/MWh
 *   - PSV: gia' EUR/MWh (NB: il PSV "retail" e' EUR/Smc, ma noi memorizziamo
 *     l'asset PSV in EUR/MWh come da assets table)
 *   - CO2: EUR/tCO2 - moltiplicato per emission_factor = EUR/MWh elettrico
 */
export interface SparkSpreadInputs {
  punEurPerMwh: number;
  psvEurPerMwh: number;
  co2EurPerTon: number;
  heatRateMwhGasPerMwhEl?: number; // default 1.8
  emissionFactorTcoPerMwhEl?: number; // default 0.35
}

export function computeSparkSpread(p: SparkSpreadInputs): number {
  const heat = p.heatRateMwhGasPerMwhEl ?? 1.8;
  const emission = p.emissionFactorTcoPerMwhEl ?? 0.35;
  return p.punEurPerMwh - p.psvEurPerMwh * heat - p.co2EurPerTon * emission;
}

/**
 * Calcola percentili storici di una serie. Per il context "questo spread
 * e' alto/basso vs storico ultimo anno", default percentili 10/25/50/75/90.
 */
export function computePercentiles(
  values: number[],
  qs: number[] = [0.1, 0.25, 0.5, 0.75, 0.9],
): Record<string, number> {
  if (values.length === 0) return Object.fromEntries(qs.map((q) => [q.toString(), Number.NaN]));
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  const result: Record<string, number> = {};
  for (const q of qs) {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length + 1)) - 1));
    result[q.toString()] = sorted[idx];
  }
  return result;
}

// ============================================
// 2. ATR (Average True Range) - volatility metric
// ============================================

/**
 * Per dati daily senza OHLC, approssimiamo l'ATR come media mobile delle
 * variazioni assolute giornaliere (|close[t] - close[t-1]|) su finestra
 * di N giorni. Output in EUR/MWh.
 *
 * Ritorna un array con stesso length di values; primi N-1 sono null.
 */
export function computeAtr(values: number[], windowDays: number = 14): (number | null)[] {
  if (values.length === 0) return [];
  const trueRanges: number[] = [0]; // primo giorno non ha lag-1
  for (let i = 1; i < values.length; i++) {
    trueRanges.push(Math.abs(values[i] - values[i - 1]));
  }
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < windowDays) return out;
  let sum = 0;
  for (let i = 1; i <= windowDays; i++) sum += trueRanges[i] ?? 0;
  out[windowDays] = sum / windowDays;
  for (let i = windowDays + 1; i < values.length; i++) {
    sum += trueRanges[i] - trueRanges[i - windowDays];
    out[i] = sum / windowDays;
  }
  return out;
}

// ============================================
// 3. CORRELATION MATRIX rolling
// ============================================

/**
 * Pearson correlation tra due serie allineate.
 */
export function pearsonCorrelation(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length === 0) return Number.NaN;
  const n = xs.length;
  let meanX = 0,
    meanY = 0;
  for (let i = 0; i < n; i++) {
    meanX += xs[i];
    meanY += ys[i];
  }
  meanX /= n;
  meanY /= n;
  let cov = 0,
    varX = 0,
    varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  const denom = Math.sqrt(varX * varY);
  if (denom === 0) return Number.NaN;
  return cov / denom;
}

export interface SeriesByAsset {
  [assetSlug: string]: DailyObservation[];
}

export interface CorrelationCell {
  assetA: string;
  assetB: string;
  correlation: number;
  nObs: number;
}

/**
 * Calcola matrice correlazione tra TUTTI gli asset, allineati sui giorni
 * COMUNI agli ultimi `windowDays` giorni. Restituisce array di celle.
 *
 * NB: per allineare le serie, prima troviamo le date comuni alle ultime
 * `windowDays` osservazioni piu' recenti di ciascuno; poi calcoliamo
 * correlazione sulle daily returns (variazione % giornaliera, non
 * sul livello prezzo che ha trend).
 */
export function computeCorrelationMatrix(
  seriesByAsset: SeriesByAsset,
  windowDays: number = 30,
): CorrelationCell[] {
  const assets = Object.keys(seriesByAsset).sort();
  const cells: CorrelationCell[] = [];

  // Indicizza ogni serie per date (mappa date -> value)
  const indexed: Record<string, Map<string, number>> = {};
  for (const a of assets) {
    indexed[a] = new Map(seriesByAsset[a].map((p) => [p.date, p.value]));
  }

  for (let i = 0; i < assets.length; i++) {
    for (let j = 0; j < assets.length; j++) {
      const a = assets[i];
      const b = assets[j];
      if (i === j) {
        cells.push({ assetA: a, assetB: b, correlation: 1, nObs: indexed[a].size });
        continue;
      }
      // Trova date COMUNI ai due asset
      const commonDates = [...indexed[a].keys()].filter((d) => indexed[b].has(d)).sort();
      // Limita agli ultimi windowDays
      const recent = commonDates.slice(-windowDays);
      if (recent.length < 5) {
        cells.push({ assetA: a, assetB: b, correlation: Number.NaN, nObs: recent.length });
        continue;
      }
      // Calcola log-returns invece dei livelli (piu' robusto per series con trend)
      const valsA: number[] = [];
      const valsB: number[] = [];
      for (let k = 1; k < recent.length; k++) {
        const prevA = indexed[a].get(recent[k - 1])!;
        const currA = indexed[a].get(recent[k])!;
        const prevB = indexed[b].get(recent[k - 1])!;
        const currB = indexed[b].get(recent[k])!;
        if (prevA > 0 && prevB > 0) {
          valsA.push(Math.log(currA / prevA));
          valsB.push(Math.log(currB / prevB));
        }
      }
      const r = pearsonCorrelation(valsA, valsB);
      cells.push({ assetA: a, assetB: b, correlation: r, nObs: valsA.length });
    }
  }
  return cells;
}

// ============================================
// 4. CROSS SPREADS
// ============================================

/**
 * PSV * 10.5275 / 1000 -> conversione da EUR/MWh gas a EUR/MWh termico
 * equivalente elettrico via heat rate. Per la "convergenza gas-power" gli
 * analisti guardano differenza diretta in EUR/MWh tra PUN e PSV.
 *
 * cross_spread_pun_psv = PUN - PSV  (entrambi in EUR/MWh, senza heat rate)
 *   - positivo: power premium su gas (CCGT genera margine)
 *   - negativo: gas piu' caro del power (CCGT non economica)
 */
export function computePunPsvCrossSpread(pun: number, psv: number): number {
  return pun - psv;
}

/**
 * PSV - TTF in EUR/MWh: il "premio Italia" del gas, dovuto a logistica
 * (LNG terminal, pipeline cost, congestione TAP/TAG/Greenstream).
 *   - positivo (tipico 0.5-3 EUR/MWh): gas italiano piu' caro del benchmark europeo
 *   - negativo: gas italiano piu' a sconto vs Europa (raro, di solito in summer)
 */
export function computePsvTtfPremium(psv: number, ttf: number): number {
  return psv - ttf;
}
