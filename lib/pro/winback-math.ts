/**
 * Win-back Optimizer — pure math.
 *
 * Dato un ex-cliente perso (cosa pagava, da chi e' stato preso, tempo dalla
 * perdita), suggerisce 3 strategie di riconquista ranked per ROI atteso
 * (LTV recuperato − costo offerta) / costo offerta.
 *
 * Modello: probabilita' di accettazione e' funzione di:
 *  - Discount % offerto vs prezzo che paga ora (con competitor)
 *  - Tempo dalla perdita (decadimento esponenziale, dopo 12+ mesi e' molto difficile)
 *  - Tipo offerta proposta (fisso vs variabile vs bundle)
 *  - Switch cost percepito (gia' una volta switched, piu' facile rifarlo)
 *
 * No I/O, pure math testabile in isolamento.
 */

export type CustomerSegment = "domestico" | "pmi" | "industriale";

export interface WinbackInputs {
  segment: CustomerSegment;
  /** Prezzo che pagava con noi prima di andare via (€/MWh) */
  previousPriceEurPerMwh: number;
  /** Volume annuo cliente (kWh) */
  annualKwh: number;
  /** Mesi trascorsi dalla perdita del cliente */
  monthsSinceLost: number;
  /** Prezzo che paga ora col competitor (€/MWh) */
  competitorPriceEurPerMwh: number;
}

export type WinbackStrategy = "discount" | "lock-fisso" | "bundle";

export interface WinbackOffer {
  strategy: WinbackStrategy;
  label: string;
  description: string;
  /** Prezzo proposto al cliente (€/MWh) */
  proposedPriceEurPerMwh: number;
  /** Probabilita' di accettazione 0..1 */
  acceptanceProb: number;
  /** Costo annuo dell'offerta vs prezzo "fair market" (€) — discount erogato */
  yearlyDiscountCostEur: number;
  /** LTV netto atteso se accettato (€), 36 mesi default orizzonte */
  expectedNetLtvEur: number;
  /** ROI = expectedNetLtv / yearlyDiscountCost */
  roi: number;
  /** Payback in mesi (yearlyDiscountCost / margine mensile) */
  paybackMonths: number;
  /** Locked nel demo (visibile ma blurred) */
  locked: boolean;
}

export interface WinbackResult {
  offers: WinbackOffer[]; // ranked per ROI desc
  /** Probabilita' di non riconquistarlo affatto (1 - max(acceptanceProb)) */
  notWinnableProb: number;
}

/**
 * Decadimento temporale: piu' tempo passa, meno il cliente e' aperto al rientro.
 * Modello esponenziale con half-life di 8 mesi.
 */
function timeDecayFactor(monthsSinceLost: number): number {
  const halfLife = 8;
  return Math.pow(0.5, monthsSinceLost / halfLife);
}

/**
 * Probabilita' di accettazione base data una % di sconto sul prezzo competitor.
 * - 0% sconto → ~5% (nessun incentivo razionale)
 * - 10% sconto → ~30%
 * - 20% sconto → ~55%
 * - 30%+ → cap ~70% (oltre, scetticismo / lock-in psicologico)
 */
function baseAcceptance(discountVsCompetitorPct: number): number {
  if (discountVsCompetitorPct <= 0) return 0.05;
  if (discountVsCompetitorPct >= 0.3) return 0.7;
  return 0.05 + (discountVsCompetitorPct / 0.3) * 0.65;
}

/** Margine annuo per il fornitore = (prezzo proposto - costo) × volume */
function yearlyMargin(
  proposedPriceEurPerMwh: number,
  costEurPerMwh: number,
  annualKwh: number,
): number {
  return ((proposedPriceEurPerMwh - costEurPerMwh) / 1000) * annualKwh;
}

/**
 * Calcola le 3 offerte di win-back per il cliente perso, ranked per ROI.
 */
export function computeWinback(inputs: WinbackInputs): WinbackResult {
  // Assumiamo costo di approvvigionamento = PUN forecast medio per il fornitore
  // (proxy: 85% del prezzo competitor — competitor ha qualche markup)
  const costEurPerMwh = inputs.competitorPriceEurPerMwh * 0.85;
  const decay = timeDecayFactor(inputs.monthsSinceLost);
  const segmentMultiplier =
    inputs.segment === "domestico" ? 1.0 : inputs.segment === "pmi" ? 0.9 : 0.7;
  const ltvHorizonMonths = 36;

  // STRATEGY 1: Discount aggressivo (-15% vs competitor)
  const discountPrice = inputs.competitorPriceEurPerMwh * 0.85;
  const discountPct1 = 1 - discountPrice / inputs.competitorPriceEurPerMwh;
  const acceptance1 = baseAcceptance(discountPct1) * decay * segmentMultiplier;
  const yearlyMargin1 = yearlyMargin(discountPrice, costEurPerMwh, inputs.annualKwh);
  const yearlyCost1 =
    yearlyMargin(inputs.competitorPriceEurPerMwh, costEurPerMwh, inputs.annualKwh) -
    yearlyMargin1; // discount "perso" rispetto a vendere a prezzo competitor

  const offer1: WinbackOffer = {
    strategy: "discount",
    label: "Discount aggressivo (-15% vs competitor)",
    description: `Proponi ${discountPrice.toFixed(1)} €/MWh (-15% rispetto al ${inputs.competitorPriceEurPerMwh.toFixed(0)} €/MWh attuale). Strategia tattica per riconquista veloce, margine ridotto ma alto take-rate.`,
    proposedPriceEurPerMwh: discountPrice,
    acceptanceProb: acceptance1,
    yearlyDiscountCostEur: Math.max(0, yearlyCost1),
    expectedNetLtvEur: (yearlyMargin1 * ltvHorizonMonths) / 12 * acceptance1,
    roi: yearlyCost1 > 0 ? ((yearlyMargin1 * ltvHorizonMonths) / 12) / yearlyCost1 : Infinity,
    paybackMonths:
      yearlyMargin1 > 0 ? (yearlyCost1 / (yearlyMargin1 / 12)) : Infinity,
    locked: false,
  };

  // STRATEGY 2: Prezzo fisso 24 mesi (-10% vs competitor, locked-in)
  const fissoPrice = inputs.competitorPriceEurPerMwh * 0.9;
  const discountPct2 = 1 - fissoPrice / inputs.competitorPriceEurPerMwh;
  const acceptance2 =
    baseAcceptance(discountPct2) * decay * segmentMultiplier * 1.15; // bonus lock-in apprezzato in volatilita'
  const yearlyMargin2 = yearlyMargin(fissoPrice, costEurPerMwh, inputs.annualKwh);
  const yearlyCost2 =
    yearlyMargin(inputs.competitorPriceEurPerMwh, costEurPerMwh, inputs.annualKwh) -
    yearlyMargin2;

  const offer2: WinbackOffer = {
    strategy: "lock-fisso",
    label: "Lock prezzo fisso 24 mesi (-10%)",
    description: `Proponi ${fissoPrice.toFixed(1)} €/MWh fisso per 24 mesi. Cliente apprezza protezione da volatilita' PUN/PSV, take-rate piu' alto di pure discount.`,
    proposedPriceEurPerMwh: fissoPrice,
    acceptanceProb: Math.min(0.85, acceptance2),
    yearlyDiscountCostEur: Math.max(0, yearlyCost2),
    expectedNetLtvEur:
      (yearlyMargin2 * ltvHorizonMonths) / 12 * Math.min(0.85, acceptance2),
    roi: yearlyCost2 > 0 ? ((yearlyMargin2 * ltvHorizonMonths) / 12) / yearlyCost2 : Infinity,
    paybackMonths:
      yearlyMargin2 > 0 ? (yearlyCost2 / (yearlyMargin2 / 12)) : Infinity,
    locked: true,
  };

  // STRATEGY 3: Bundle gas a -10€/MWh
  const bundlePrice = inputs.competitorPriceEurPerMwh * 0.93;
  const discountPct3 = 1 - bundlePrice / inputs.competitorPriceEurPerMwh;
  const acceptance3 =
    baseAcceptance(discountPct3) * decay * segmentMultiplier * 1.2; // cross-sell bonus
  const yearlyMargin3 =
    yearlyMargin(bundlePrice, costEurPerMwh, inputs.annualKwh) + 250; // margine gas bonus stimato
  const yearlyCost3 =
    yearlyMargin(inputs.competitorPriceEurPerMwh, costEurPerMwh, inputs.annualKwh) -
    yearlyMargin(bundlePrice, costEurPerMwh, inputs.annualKwh);

  const offer3: WinbackOffer = {
    strategy: "bundle",
    label: "Bundle gas a -10€/MWh come incentivo",
    description: `Proponi ${bundlePrice.toFixed(1)} €/MWh luce + gas a -10€/MWh sotto market. Lock-in commerciale piu' forte (2 commodity = -40% churn), payback piu' rapido grazie a margine gas.`,
    proposedPriceEurPerMwh: bundlePrice,
    acceptanceProb: Math.min(0.85, acceptance3),
    yearlyDiscountCostEur: Math.max(0, yearlyCost3),
    expectedNetLtvEur:
      (yearlyMargin3 * ltvHorizonMonths) / 12 * Math.min(0.85, acceptance3),
    roi: yearlyCost3 > 0 ? ((yearlyMargin3 * ltvHorizonMonths) / 12) / yearlyCost3 : Infinity,
    paybackMonths:
      yearlyMargin3 > 0 ? (yearlyCost3 / (yearlyMargin3 / 12)) : Infinity,
    locked: true,
  };

  // Sort per ROI desc; ma demo limit: solo #1 unlocked per garantire il "vedi 1, sblocca 2"
  const ranked = [offer1, offer2, offer3].sort((a, b) => b.roi - a.roi);

  // Re-set locked flags in base alla posizione (#1 sempre unlocked, #2 e #3 locked)
  ranked.forEach((o, i) => {
    o.locked = i > 0;
  });

  const maxAcceptance = Math.max(...ranked.map((o) => o.acceptanceProb));
  const notWinnableProb = 1 - maxAcceptance;

  return { offers: ranked, notWinnableProb };
}
