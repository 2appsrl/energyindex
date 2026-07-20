/**
 * Customer Simulator math: dato un profilo consumatore e l'elenco
 * delle offerte mercato libero, calcola il costo annuo totale per
 * ciascuna offerta e ritorna il ranking.
 *
 * Formula:
 *   total_cost_anno = (effective_price_per_unit * volume_anno)
 *                   + (fixed_cost_monthly * 12)
 *
 * effective_price_per_unit per le offerte variabili = forecast_avg + spread.
 * Per le offerte fisse = price_value (assoluto).
 */

export interface OfferRecord {
  offer_code: string;
  supplier: string;
  supplier_logo_url: string | null;
  offer_name: string | null;
  commodity: "electricity" | "gas";
  price_type: "fisso" | "variabile";
  price_value: number;             // per-kWh o per-Smc
  fixed_cost_monthly: number | null;
  customer_segment: "domestico" | "business";
  source_url: string | null;
  notes: string | null;
}

export interface ForecastAverages {
  punAvgEurPerKwh: number;         // forecast PUN medio 12 mesi (gia' in EUR/kWh)
  psvAvgEurPerSmc: number;         // forecast PSV medio 12 mesi (in EUR/Smc)
}

export interface CustomerInputs {
  volumeKwhAnno: number;           // consumo luce
  volumeSmcAnno: number;           // consumo gas
}

export interface OfferRanking {
  offer: OfferRecord;
  effectivePriceEurPerUnit: number;
  annualEnergyCostEur: number;     // price * volume
  annualFixedCostEur: number;      // fixed * 12
  totalAnnualCostEur: number;      // sum
}

/**
 * Rank offerte per commodity in ordine crescente di costo annuo totale.
 * Per le variabili, somma forecast medio + spread per ottenere il prezzo
 * effettivo per unita'.
 */
export function rankOffers(
  offers: OfferRecord[],
  forecast: ForecastAverages,
  volume: number,
  commodity: "electricity" | "gas",
): OfferRanking[] {
  const forecastBase = commodity === "electricity"
    ? forecast.punAvgEurPerKwh
    : forecast.psvAvgEurPerSmc;

  const ranked: OfferRanking[] = offers
    .filter((o) => o.commodity === commodity && o.customer_segment === "domestico")
    .map((o) => {
      const effective = o.price_type === "fisso"
        ? o.price_value
        : forecastBase + o.price_value;          // variabile = forecast + spread
      const energyCost = effective * volume;
      const fixedCost = (o.fixed_cost_monthly ?? 0) * 12;
      return {
        offer: o,
        effectivePriceEurPerUnit: effective,
        annualEnergyCostEur: energyCost,
        annualFixedCostEur: fixedCost,
        totalAnnualCostEur: energyCost + fixedCost,
      };
    })
    .sort((a, b) => a.totalAnnualCostEur - b.totalAnnualCostEur);

  return ranked;
}
