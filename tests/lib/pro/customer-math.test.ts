/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { rankOffers, type OfferRecord, type ForecastAverages } from "@/lib/pro/customer-math";

const FORECAST: ForecastAverages = {
  punAvgEurPerKwh: 0.10,
  psvAvgEurPerSmc: 0.40,
};

function makeOffer(p: Partial<OfferRecord> & { offer_code: string; price_value: number }): OfferRecord {
  return {
    offer_code: p.offer_code,
    supplier: p.supplier ?? "Test Supplier",
    supplier_logo_url: null,
    offer_name: p.offer_name ?? null,
    commodity: p.commodity ?? "electricity",
    price_type: p.price_type ?? "fisso",
    price_value: p.price_value,
    fixed_cost_monthly: p.fixed_cost_monthly ?? 0,
    customer_segment: p.customer_segment ?? "domestico",
    source_url: null,
    notes: null,
  };
}

describe("rankOffers", () => {
  it("ordina per total annual cost ascending", () => {
    const offers = [
      makeOffer({ offer_code: "A", price_value: 0.20, fixed_cost_monthly: 5 }),
      makeOffer({ offer_code: "B", price_value: 0.15, fixed_cost_monthly: 10 }),
      makeOffer({ offer_code: "C", price_value: 0.18, fixed_cost_monthly: 0 }),
    ];
    const r = rankOffers(offers, FORECAST, 2700, "electricity");
    // A: 0.20*2700 + 60 = 600
    // B: 0.15*2700 + 120 = 525
    // C: 0.18*2700 + 0 = 486
    expect(r[0].offer.offer_code).toBe("C");
    expect(r[1].offer.offer_code).toBe("B");
    expect(r[2].offer.offer_code).toBe("A");
  });

  it("variabile usa forecast + spread come prezzo effettivo", () => {
    const offers = [
      makeOffer({ offer_code: "VAR", price_value: 0.02, price_type: "variabile", fixed_cost_monthly: 5 }),
      makeOffer({ offer_code: "FIX", price_value: 0.15, price_type: "fisso", fixed_cost_monthly: 5 }),
    ];
    const r = rankOffers(offers, FORECAST, 2700, "electricity");
    // VAR effective = 0.10 + 0.02 = 0.12; cost = 0.12*2700 + 60 = 384
    // FIX effective = 0.15; cost = 0.15*2700 + 60 = 465
    expect(r[0].offer.offer_code).toBe("VAR");
    expect(r[0].effectivePriceEurPerUnit).toBeCloseTo(0.12, 4);
  });

  it("a basso consumo vince fixed_cost basso anche se prezzo alto (KEY UX MOMENT)", () => {
    const offers = [
      makeOffer({ offer_code: "HighPriceLowFixed", price_value: 0.25, fixed_cost_monthly: 2 }),
      makeOffer({ offer_code: "LowPriceHighFixed", price_value: 0.10, fixed_cost_monthly: 20 }),
    ];
    // A 500 kWh/anno:
    // HighPriceLowFixed: 0.25*500 + 24 = 149
    // LowPriceHighFixed: 0.10*500 + 240 = 290
    const low = rankOffers(offers, FORECAST, 500, "electricity");
    expect(low[0].offer.offer_code).toBe("HighPriceLowFixed");

    // A 10000 kWh/anno il vincitore si inverte:
    // HighPriceLowFixed: 0.25*10000 + 24 = 2524
    // LowPriceHighFixed: 0.10*10000 + 240 = 1240
    const high = rankOffers(offers, FORECAST, 10000, "electricity");
    expect(high[0].offer.offer_code).toBe("LowPriceHighFixed");
  });

  it("filtra solo customer_segment='domestico'", () => {
    const offers = [
      makeOffer({ offer_code: "DOM", customer_segment: "domestico", price_value: 0.15 }),
      makeOffer({ offer_code: "BIZ", customer_segment: "business", price_value: 0.10 }),
    ];
    const r = rankOffers(offers, FORECAST, 2700, "electricity");
    expect(r).toHaveLength(1);
    expect(r[0].offer.offer_code).toBe("DOM");
  });
});
