/**
 * Slice 9 — EIDX Pro Margin Simulator math foundation.
 *
 * Pure functions, no I/O. KPI calculation for retail electricity/gas
 * contracts assuming a PUN+spread (cost passthrough) pricing model.
 *
 * See AGENTS / Slice 9 design notes for the underlying assumptions.
 */

export type ContractType = "variabile" | "fisso";

export interface SimulatorInputs {
  /** Volume annuo cliente in kWh. */
  volumeKwhPerYear: number;
  /** Durata contratto in mesi (tipicamente 6 | 12 | 18 | 24). */
  contractMonths: number;
  /** Markup vendita applicato sopra il costo di approvvigionamento, €/MWh. */
  spreadEurPerMwh: number;
  /** Costo acquisizione cliente, EUR (one-shot). */
  cacEur: number;
  /** Churn atteso annuo, frazione 0–1 (es. 0.14 = 14%). */
  churnAnnualPct: number;
  /** Overhead di approvvigionamento sopra il PUN, €/MWh. Default 3. */
  approvOverheadEurPerMwh?: number;
  /**
   * Tipo contratto:
   * - "variabile": PUN passthrough. Cliente assorbe le variazioni di mercato,
   *   il margine = spread × volume (invariato sotto cost shock).
   * - "fisso": lock-in. Fornitore assorbe il rischio prezzo: un cost shock
   *   riduce lo spread effettivo dello stesso importo.
   */
  contractType: ContractType;
}

export interface ForecastBand {
  /** Media del forecast PUN sulla durata contratto, €/MWh. */
  averageEurPerMwh: number;
  /** Banda inferiore (P10 o simile), €/MWh. */
  lowerEurPerMwh: number;
  /** Banda superiore (P90 o simile), €/MWh. */
  upperEurPerMwh: number;
}

export interface KpiResult {
  /** Costo medio approvvigionamento = avg(PUN) + overhead, €/MWh. */
  costoApprovvigionamentoEurPerMwh: number;
  /** Prezzo finale al cliente = costo + spread, €/MWh. */
  prezzoVenditaEurPerMwh: number;
  /** Margine lordo annuo per cliente, EUR. */
  margineAnnoEur: number;
  /** LTV netto (margine cumulato × retention − CAC), EUR. */
  ltvContrattoEur: number;
  /** Revenue lorda totale contratto = prezzo × volume × anni, EUR. */
  contractValueEur: number;
}

export type ScenarioName = "base" | "inverno_freddo" | "ttf_spike" | "recessione_domanda";

export interface ScenarioModifier {
  name: ScenarioName;
  label: string;
  /** Moltiplicatore sul volume (es. 1.10 = +10%). */
  volumeMultiplier: number;
  /** Shock additivo sul costo €/MWh (es. +8 = costo +8 €/MWh). */
  costShockEurPerMwh: number;
}

export const SCENARIOS: ScenarioModifier[] = [
  { name: "base", label: "Base case", volumeMultiplier: 1.0, costShockEurPerMwh: 0 },
  {
    name: "inverno_freddo",
    label: "Inverno freddo +10% volume",
    volumeMultiplier: 1.1,
    costShockEurPerMwh: 0,
  },
  {
    name: "ttf_spike",
    label: "TTF +20% (costo +8 €/MWh)",
    volumeMultiplier: 1.0,
    costShockEurPerMwh: 8,
  },
  {
    name: "recessione_domanda",
    label: "Recessione domanda −5%",
    volumeMultiplier: 0.95,
    costShockEurPerMwh: 0,
  },
];

const DEFAULT_APPROV_OVERHEAD_EUR_PER_MWH = 3;

/**
 * Somma geometrica della retention su `years` anni.
 *
 * - churn = 0 -> Σ = years (lineare)
 * - 0 < churn <= 1 -> Σ = (1 − (1 − churn)^years) / churn
 *
 * Supporta `years` frazionari (es. 1.5 per contratti 18 mesi).
 */
function geometricRetentionSum(years: number, churnAnnualPct: number): number {
  if (churnAnnualPct <= 0) return years;
  const ratio = 1 - churnAnnualPct;
  return (1 - Math.pow(ratio, years)) / churnAnnualPct;
}

export function computeKpi(inputs: SimulatorInputs, forecast: ForecastBand): KpiResult {
  const overhead = inputs.approvOverheadEurPerMwh ?? DEFAULT_APPROV_OVERHEAD_EUR_PER_MWH;
  const costoApprovvigionamentoEurPerMwh = forecast.averageEurPerMwh + overhead;
  const prezzoVenditaEurPerMwh = costoApprovvigionamentoEurPerMwh + inputs.spreadEurPerMwh;

  const volumeMwh = inputs.volumeKwhPerYear / 1000;
  const margineAnnoEur = inputs.spreadEurPerMwh * volumeMwh;

  const years = inputs.contractMonths / 12;
  const retentionSum = geometricRetentionSum(years, inputs.churnAnnualPct);
  const ltvGross = margineAnnoEur * retentionSum;
  const ltvContrattoEur = ltvGross - inputs.cacEur;

  const contractValueEur = prezzoVenditaEurPerMwh * volumeMwh * years;

  return {
    costoApprovvigionamentoEurPerMwh,
    prezzoVenditaEurPerMwh,
    margineAnnoEur,
    ltvContrattoEur,
    contractValueEur,
  };
}

/**
 * Applica uno scenario di stress: scala il volume per `volumeMultiplier`
 * e somma `costShockEurPerMwh` al PUN medio del forecast, poi ricalcola
 * il KPI.
 *
 * In modalita "variabile" (PUN passthrough) il margine dipende solo dal
 * volume — il cost shock passa al cliente.
 *
 * In modalita "fisso" (lock-in) il fornitore assorbe il rischio prezzo:
 * il cost shock riduce lo spread effettivo dello stesso importo, erodendo
 * il margine.
 */
export function applyScenario(
  inputs: SimulatorInputs,
  forecast: ForecastBand,
  scenario: ScenarioModifier,
): KpiResult {
  const effectiveSpread =
    inputs.contractType === "fisso"
      ? inputs.spreadEurPerMwh - scenario.costShockEurPerMwh
      : inputs.spreadEurPerMwh;

  const effectiveInputs: SimulatorInputs = {
    ...inputs,
    volumeKwhPerYear: inputs.volumeKwhPerYear * scenario.volumeMultiplier,
    spreadEurPerMwh: effectiveSpread,
  };
  const effectiveForecast: ForecastBand = {
    averageEurPerMwh: forecast.averageEurPerMwh + scenario.costShockEurPerMwh,
    lowerEurPerMwh: forecast.lowerEurPerMwh + scenario.costShockEurPerMwh,
    upperEurPerMwh: forecast.upperEurPerMwh + scenario.costShockEurPerMwh,
  };
  return computeKpi(effectiveInputs, effectiveForecast);
}

export interface CompetitorBenchmark {
  /** Spread vendita scelto dall'utente, €/MWh. */
  yourSpreadEurPerMwh: number;
  /** Mediano di mercato per offerte comparabili, €/MWh. */
  marketMedianEurPerMwh: number;
  /** P25 di mercato, €/MWh. */
  marketP25EurPerMwh: number;
  /** P75 di mercato, €/MWh. */
  marketP75EurPerMwh: number;
}

export interface BenchmarkVerdict {
  /** Indicativo: 25 (sotto), 50 (allineato), 75 (sopra). */
  positionPercentile: number;
  /** Stringa user-facing in italiano con delta arrotondato. */
  label: string;
}

const BENCHMARK_TOLERANCE_PCT = 10;

export function computeBenchmarkVerdict(b: CompetitorBenchmark): BenchmarkVerdict {
  if (b.marketMedianEurPerMwh <= 0) {
    return { positionPercentile: 50, label: "Allineato al mercato (±10%)" };
  }
  const deltaPct = ((b.yourSpreadEurPerMwh - b.marketMedianEurPerMwh) / b.marketMedianEurPerMwh) * 100;
  const rounded = Math.round(deltaPct);
  if (deltaPct < -BENCHMARK_TOLERANCE_PCT) {
    return {
      positionPercentile: 25,
      label: `Sotto mediano (${rounded}%) — competitivo`,
    };
  }
  if (deltaPct > BENCHMARK_TOLERANCE_PCT) {
    return {
      positionPercentile: 75,
      label: `Sopra mediano (+${rounded}%) — premium`,
    };
  }
  return { positionPercentile: 50, label: "Allineato al mercato (±10%)" };
}
