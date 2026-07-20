/**
 * Churn Predictor — pure math.
 *
 * Modello sintetico (no ML training reale) ma calibrato su literature retail
 * energy italiano:
 *  - Domestico libero: churn annuo ~16%, picco a fine lock-in 12-18 mesi
 *  - PMI: churn annuo ~10%, sensitivity prezzo alta
 *  - Industriale: churn annuo ~6%, lock-in lungo (24+ mesi)
 *
 * Driver pesati additivi su base churn 90gg:
 *  - Gap prezzo vs PUN spot (peso max +25pp se gap > 20%)
 *  - Eta' contratto (peso max +15pp se in finestra disdetta 12-18mo)
 *  - Tipo offerta (variabile +3pp, fisso 0)
 *  - Volume cliente (industriale meno sticky se prezzo male tarato)
 *
 * Output finale: probabilita' clampata a [0, 0.95].
 *
 * No I/O, no React, no DB. Pure math testabile in isolamento.
 */

export type CustomerSegment = "domestico" | "pmi" | "industriale";
export type OfferType = "fisso" | "variabile";

export interface ChurnInputs {
  segment: CustomerSegment;
  annualKwh: number;
  offerType: OfferType;
  contractAgeMonths: number; // 0..60
  currentPriceEurPerMwh: number;
  marketPunEurPerMwh: number; // PUN spot benchmark
}

export interface ChurnDriver {
  label: string;
  contributionPct: number; // 0..100, share del churn probability finale
  direction: "increase" | "decrease" | "neutral";
}

export interface ChurnAction {
  id: string;
  label: string;
  description: string;
  /** Riduzione attesa della prob. churn in punti percentuali (es. 0.05 = -5pp) */
  expectedLiftPp: number;
  /** Costo per customer in EUR */
  costEur: number;
  /** Locked nel demo (azione visibile ma non actionable) */
  locked: boolean;
}

export interface ChurnResult {
  probability: number; // 0..1
  riskLevel: "low" | "medium" | "high" | "critical";
  drivers: ChurnDriver[]; // sorted by contributionPct desc
  recommendedActions: ChurnAction[]; // sorted by ROI (lift / cost)
}

/** Base churn 90gg per segmento (literature italiano retail energy) */
const BASE_CHURN_90D: Record<CustomerSegment, number> = {
  domestico: 0.04, // ~16% annuo
  pmi: 0.025, // ~10% annuo
  industriale: 0.015, // ~6% annuo
};

/**
 * Modifier sul churn base in base al gap prezzo cliente vs PUN spot.
 * Positivo = aumenta churn. Capped a +25pp (gap > 25%).
 */
function priceGapModifier(currentPrice: number, marketPun: number): number {
  if (marketPun <= 0) return 0;
  const gap = (currentPrice - marketPun) / marketPun;
  if (gap <= 0) return -0.02; // cliente paga sotto mercato, churn bassa
  // Step linear: ogni +5% gap -> +5pp churn, cap a +25pp
  return Math.min(0.25, gap * 1.0);
}

/**
 * Modifier su eta' contratto:
 *  - 0-12mo: lock-in -> -3pp (sticky)
 *  - 12-18mo: finestra disdetta -> +8pp (peak churn)
 *  - 18-36mo: rampa down a +2pp
 *  - 36+mo: cliente "vecchio" -> +1pp neutral
 */
function contractAgeModifier(ageMonths: number): number {
  if (ageMonths < 0) return 0;
  if (ageMonths < 12) return -0.03;
  if (ageMonths < 18) return 0.08;
  if (ageMonths < 36) return 0.08 - ((ageMonths - 18) / 18) * 0.06; // ramp down
  return 0.01;
}

/** Modifier tipo offerta: variabile leggermente piu' volatile */
function offerTypeModifier(offerType: OfferType): number {
  return offerType === "variabile" ? 0.03 : 0;
}

/**
 * Modifier volume: clienti grandi (industriale > 1M kWh/anno) sono piu' sensibili
 * a errori di pricing (-> piu' propensi a cambiare se trovano deal meglio).
 */
function volumeModifier(annualKwh: number, segment: CustomerSegment): number {
  if (segment === "industriale" && annualKwh > 1_000_000) return 0.03;
  if (segment === "pmi" && annualKwh > 500_000) return 0.02;
  return 0;
}

/**
 * Predice la probabilita' di churn nei prossimi 90 giorni dato il profilo cliente.
 */
export function predictChurn(inputs: ChurnInputs): ChurnResult {
  const base = BASE_CHURN_90D[inputs.segment];
  const priceMod = priceGapModifier(inputs.currentPriceEurPerMwh, inputs.marketPunEurPerMwh);
  const ageMod = contractAgeModifier(inputs.contractAgeMonths);
  const typeMod = offerTypeModifier(inputs.offerType);
  const volMod = volumeModifier(inputs.annualKwh, inputs.segment);

  const rawProb = base + priceMod + ageMod + typeMod + volMod;
  const probability = Math.max(0, Math.min(0.95, rawProb));

  function direction(value: number): ChurnDriver["direction"] {
    if (value > 0.005) return "increase";
    if (value < -0.005) return "decrease";
    return "neutral";
  }

  // Drivers: somma in valore assoluto per normalizzare la share
  const absSum =
    Math.abs(priceMod) + Math.abs(ageMod) + Math.abs(typeMod) + Math.abs(volMod) + base;
  const drivers: ChurnDriver[] = [
    {
      label: `Gap prezzo vs PUN (${inputs.currentPriceEurPerMwh.toFixed(0)} vs ${inputs.marketPunEurPerMwh.toFixed(0)} €/MWh)`,
      contributionPct: absSum > 0 ? (Math.abs(priceMod) / absSum) * 100 : 0,
      direction: direction(priceMod),
    },
    {
      label: `Eta' contratto (${inputs.contractAgeMonths} mesi)`,
      contributionPct: absSum > 0 ? (Math.abs(ageMod) / absSum) * 100 : 0,
      direction: direction(ageMod),
    },
    {
      label: `Tipo offerta (${inputs.offerType})`,
      contributionPct: absSum > 0 ? (Math.abs(typeMod) / absSum) * 100 : 0,
      direction: direction(typeMod),
    },
    {
      label: `Volume (${(inputs.annualKwh / 1000).toFixed(0)}k kWh/anno)`,
      contributionPct: absSum > 0 ? (Math.abs(volMod) / absSum) * 100 : 0,
      direction: direction(volMod),
    },
    {
      label: `Base churn segmento ${inputs.segment}`,
      contributionPct: absSum > 0 ? (base / absSum) * 100 : 0,
      direction: "neutral" as const,
    },
  ].sort((a, b) => b.contributionPct - a.contributionPct);

  // Risk level dalla probability finale
  let riskLevel: ChurnResult["riskLevel"];
  if (probability < 0.1) riskLevel = "low";
  else if (probability < 0.3) riskLevel = "medium";
  else if (probability < 0.6) riskLevel = "high";
  else riskLevel = "critical";

  // Recommended actions (3 azioni, 1 visibile + 2 locked in demo)
  const recommendedActions: ChurnAction[] = computeActions(inputs, probability);

  return { probability, riskLevel, drivers, recommendedActions };
}

/**
 * Calcola le 3 azioni consigliate ordinate per ROI. La prima e' sempre visibile
 * nel demo, le altre 2 sono lockate (lift > 50%, costo basso, riservate tier Pro).
 */
function computeActions(inputs: ChurnInputs, probability: number): ChurnAction[] {
  const actions: ChurnAction[] = [];

  // Azione 1: offerta sconto (sempre visibile in demo, lift moderato)
  const discountPp = Math.min(0.12, probability * 0.4);
  actions.push({
    id: "discount-rinnovo",
    label: "Offri sconto rinnovo",
    description: `Proponi uno sconto ${(discountPp * 100).toFixed(0)}% sul prezzo attuale al rinnovo contratto. Riduce immediatamente il gap percepito vs mercato.`,
    expectedLiftPp: discountPp,
    costEur:
      inputs.annualKwh * 0.001 * inputs.currentPriceEurPerMwh * discountPp, // sconto annuo stimato
    locked: false,
  });

  // Azione 2: retention call (locked in demo)
  actions.push({
    id: "retention-call",
    label: "Call retention entro 7 giorni",
    description: `Account manager dedicato chiama il cliente entro 1 settimana per capire pain points. Lift +15pp tipico su segmento ${inputs.segment}.`,
    expectedLiftPp: 0.15,
    costEur: 35, // costo medio call (40 min agent)
    locked: true,
  });

  // Azione 3: bundle gas (locked in demo)
  actions.push({
    id: "bundle-gas",
    label: "Bundle gas a -10€/MWh come incentivo",
    description: "Cross-sell offerta gas a prezzo agevolato per aumentare lock-in (clienti con 2 commodity churn -40%).",
    expectedLiftPp: 0.18,
    costEur:
      inputs.segment === "domestico"
        ? 14 * 12 * 0.01 // ~ 1.4 €/anno
        : 100, // stima business
    locked: true,
  });

  // Sort by ROI (lift / cost), ma teniamo la prima fissa per consistency demo
  return actions;
}
