/**
 * Dynamic Pricing Engine — pure math.
 *
 * Dato un cluster cliente + competitor benchmark (P25/median/P75 dello spread
 * sul mercato libero), raccomanda lo spread ottimale per massimizzare
 * volume × margine (compromesso classico price elasticity).
 *
 * Modello sintetico ma realistico:
 *  - Take-rate funzione del posizionamento vs mediana competitor
 *  - Cluster diversi hanno elasticita' diverse (industriale > pmi > domestico)
 *  - Output: 3 punti su price ladder (aggressive / balanced / premium) con
 *    take-rate stimata + revenue × margine atteso per 100 prospect
 *
 * No I/O. Pure math testabile.
 */

export type ClusterId = "pmi" | "domestico" | "industriale" | "vulnerabili" | "ho_re_ca";

export interface ClusterDef {
  id: ClusterId;
  label: string;
  description: string;
  typicalAnnualKwh: number;
  /** Elasticita' prezzo: piu' alta = clienti piu' sensibili a sconti */
  priceElasticity: number; // 0.5..2.0
  locked: boolean;
}

export interface CompetitorBenchmark {
  /** Spread €/MWh al 25° percentile (offerte aggressive) */
  p25: number;
  /** Spread mediano */
  median: number;
  /** Spread al 75° percentile (offerte premium) */
  p75: number;
  /** Numero di offerte considerate */
  nOfferte: number;
}

export interface PricePoint {
  id: "aggressive" | "balanced" | "premium";
  label: string;
  spreadEurPerMwh: number;
  /** Probabilita' di vincita per 1 prospect 0..1 */
  takeRate: number;
  /** Revenue annuo atteso per 100 prospect (€) */
  expectedRevenuePer100Prospects: number;
  /** Margine annuo atteso per 100 prospect (€) */
  expectedMarginPer100Prospects: number;
  /** Margine per cliente acquisito (€) */
  marginPerAcquiredEur: number;
  locked: boolean;
}

export interface PricingRecommendation {
  cluster: ClusterDef;
  ladder: PricePoint[]; // sempre 3 punti, ranked per expected margin desc
  optimalIndex: number; // indice in ladder del punto a max margine
}

/**
 * Catalogo cluster pre-definiti. Solo "pmi" e' unlocked in demo, gli altri 4
 * sono lockati e visibili solo come teaser.
 */
export const CLUSTERS: ClusterDef[] = [
  {
    id: "pmi",
    label: "PMI commerciale",
    description: "Negozi, ristoranti, piccoli uffici. Consumo medio 250.000 kWh/anno, elasticita' moderata.",
    typicalAnnualKwh: 250_000,
    priceElasticity: 1.0,
    locked: false,
  },
  {
    id: "domestico",
    label: "Domestico famiglia",
    description: "Casa famiglia 3-4 persone, 3.500 kWh/anno. Elasticita' molto alta (price-sensitive).",
    typicalAnnualKwh: 3500,
    priceElasticity: 1.6,
    locked: true,
  },
  {
    id: "industriale",
    label: "Industriale energivoro",
    description: "PMI manifatturiera o industria leggera, 5M kWh/anno. Elasticita' bassa (lock-in tecnico).",
    typicalAnnualKwh: 5_000_000,
    priceElasticity: 0.7,
    locked: true,
  },
  {
    id: "vulnerabili",
    label: "Clienti vulnerabili",
    description: "Domestici con bonus sociali, soglie ARERA. Elasticita' moderata + regolazione.",
    typicalAnnualKwh: 2500,
    priceElasticity: 1.3,
    locked: true,
  },
  {
    id: "ho_re_ca",
    label: "HORECA (alberghi, ristoranti)",
    description: "Cluster ad alto consumo + alta stagionalita'. 800.000 kWh/anno medio.",
    typicalAnnualKwh: 800_000,
    priceElasticity: 0.9,
    locked: true,
  },
];

export function getCluster(id: ClusterId): ClusterDef | undefined {
  return CLUSTERS.find((c) => c.id === id);
}

/**
 * Take-rate model: probabilita' di vincere il cliente dato il proprio spread vs
 * mediana competitor. Sigmoid-shaped: a parita' di mediana ~50%, ogni euro
 * sotto la mediana aggiunge take-rate proporzionale a elasticita'.
 */
function takeRateFromSpread(
  spread: number,
  benchmark: CompetitorBenchmark,
  elasticity: number,
): number {
  const gapVsMedian = benchmark.median - spread; // positivo = sotto mediana
  const range = Math.max(1, benchmark.p75 - benchmark.p25);
  // Per ogni "unita'" di range sotto mediana, +25 punti percentuali di take-rate × elasticita'
  const lift = (gapVsMedian / range) * 0.25 * elasticity;
  const raw = 0.5 + lift;
  return Math.max(0.02, Math.min(0.95, raw));
}

/**
 * Costruisce 3 price point per il cluster dato il benchmark competitor.
 * Costo approvvigionamento assunto a media PUN + overhead 3 EUR/MWh.
 */
export function computePriceLadder(
  cluster: ClusterDef,
  benchmark: CompetitorBenchmark,
  costoApprovvigionamentoEurPerMwh: number,
): PricingRecommendation {
  const points: PricePoint[] = [
    {
      id: "aggressive",
      label: "Aggressive (-15% vs mediana)",
      spreadEurPerMwh: benchmark.median * 0.85,
      takeRate: 0,
      expectedRevenuePer100Prospects: 0,
      expectedMarginPer100Prospects: 0,
      marginPerAcquiredEur: 0,
      locked: false,
    },
    {
      id: "balanced",
      label: "Balanced (mediana)",
      spreadEurPerMwh: benchmark.median,
      takeRate: 0,
      expectedRevenuePer100Prospects: 0,
      expectedMarginPer100Prospects: 0,
      marginPerAcquiredEur: 0,
      locked: false,
    },
    {
      id: "premium",
      label: "Premium (+10% vs mediana)",
      spreadEurPerMwh: benchmark.median * 1.1,
      takeRate: 0,
      expectedRevenuePer100Prospects: 0,
      expectedMarginPer100Prospects: 0,
      marginPerAcquiredEur: 0,
      locked: false,
    },
  ];

  // Cliente "fair market price" implicit: cost + spread
  // Margine per cliente = spread × volume kWh (convertito da €/MWh)
  for (const p of points) {
    p.takeRate = takeRateFromSpread(p.spreadEurPerMwh, benchmark, cluster.priceElasticity);
    const marginEurPerYear = (p.spreadEurPerMwh / 1000) * cluster.typicalAnnualKwh;
    p.marginPerAcquiredEur = marginEurPerYear;
    p.expectedMarginPer100Prospects = marginEurPerYear * 100 * p.takeRate;
    p.expectedRevenuePer100Prospects =
      ((costoApprovvigionamentoEurPerMwh + p.spreadEurPerMwh) / 1000) *
      cluster.typicalAnnualKwh *
      100 *
      p.takeRate;
  }

  // Find optimal (max expected margin)
  let optimalIndex = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].expectedMarginPer100Prospects > points[optimalIndex].expectedMarginPer100Prospects) {
      optimalIndex = i;
    }
  }

  return {
    cluster,
    ladder: points,
    optimalIndex,
  };
}
