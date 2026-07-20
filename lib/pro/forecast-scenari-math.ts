/**
 * Forecast & Scenari math: sensitivity del forecast PUN a shock sui driver.
 *
 * Coefficienti basati sui pesi tipici osservati nel modello Ridge v1.0
 * addestrato sui dati storici PUN. Sono LINEARI di prima approssimazione:
 * - ogni shock impatta il PUN proporzionalmente al suo peso
 * - shock multipli si sommano (lineari, ignoriamo interazioni)
 *
 * NB: il modello Ridge vero ha 35 feature; qui esponiamo solo i 4 driver
 * piu' interpretabili dal commerciale. La banda di confidenza si allarga
 * proporzionalmente alla magnitudine totale dello shock.
 */

export interface ScenarioInputs {
  ttfShockPct: number;            // -30 .. +50 (% variazione vs baseline TTF)
  brentShockPct: number;          // -30 .. +50
  co2ShockPct: number;            // -30 .. +50
  tempAnomalyC: number;           // -5 .. +5 gradi Celsius vs media stagionale
}

export const NO_SCENARIO_SHOCKS: ScenarioInputs = {
  ttfShockPct: 0,
  brentShockPct: 0,
  co2ShockPct: 0,
  tempAnomalyC: 0,
};

// Sensitivity = % di variazione del PUN per % di variazione del driver.
// Es. TTF +10% -> PUN +5% (sensitivity 0.50).
// Per la temperatura: -1°C -> PUN +2% (sensitivity 0.02 per gradoC negativo)
const PUN_SENSITIVITY = {
  ttf: 0.50,                       // 50% del TTF passthrough sul PUN (dominante)
  brent: 0.20,                     // Brent ha impatto medio (gas-oil parity)
  co2: 0.10,                       // CO2 impatto piu' contenuto
  tempC: -0.02,                    // -1°C => +2% PUN (riscaldamento elettrico marginale)
};

/**
 * Applica uno shock combinato al baseline forecast.
 * Ritorna un moltiplicatore (es. 1.085 = +8.5% PUN).
 */
export function computePunMultiplier(shocks: ScenarioInputs): number {
  const ttfEffect = (shocks.ttfShockPct / 100) * PUN_SENSITIVITY.ttf;
  const brentEffect = (shocks.brentShockPct / 100) * PUN_SENSITIVITY.brent;
  const co2Effect = (shocks.co2ShockPct / 100) * PUN_SENSITIVITY.co2;
  const tempEffect = shocks.tempAnomalyC * PUN_SENSITIVITY.tempC;
  return 1 + ttfEffect + brentEffect + co2Effect + tempEffect;
}

export interface ForecastPoint {
  date: string;
  source: "history" | "forecast";
  value: number;
  value_lower: number | null;
  value_upper: number | null;
}

/**
 * Applica il moltiplicatore solo ai punti "forecast" (il passato rimane storico).
 * La banda si allarga in proporzione alla magnitudine assoluta dello shock,
 * per riflettere l'incertezza piu' alta degli scenari atipici.
 */
export function applyScenarioToForecast(
  baseline: ForecastPoint[],
  shocks: ScenarioInputs,
): ForecastPoint[] {
  const multiplier = computePunMultiplier(shocks);
  const shockMagnitude = Math.abs(multiplier - 1);     // 0..1
  const bandWidening = 1 + shockMagnitude * 0.5;        // banda piu' larga se shock estremo

  return baseline.map((p) => {
    if (p.source === "history") return p;
    const newValue = p.value * multiplier;
    const lower = p.value_lower !== null ? p.value_lower * multiplier - (p.value - p.value_lower) * (bandWidening - 1) : null;
    const upper = p.value_upper !== null ? p.value_upper * multiplier + (p.value_upper - p.value) * (bandWidening - 1) : null;
    return {
      ...p,
      value: newValue,
      value_lower: lower,
      value_upper: upper,
    };
  });
}
