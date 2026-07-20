/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { mapApiToDbRow } from "@/scripts/etl-energiapro-offers";
import type { EnergiaProOffer } from "@/scripts/lib/energiapro-client";

const SAMPLE: EnergiaProOffer = {
  id: "ep-offer-810001",
  offer_code: "acea-energia-acea-energia-fix-casa-fisso-electricity",
  offer_name: "Acea Energia Fix Casa",
  supplier: "Acea Energia",
  supplier_slug: "acea-energia",
  supplier_logo_url: "/logos/acea.png",
  commodity: "electricity",
  price_type: "fisso",
  price_value: 0.135,
  price_unit: "€/kWh",
  customer_segment: "domestico",
  valid_from: "2026-03-06",
  valid_to: null,
  fixed_cost_monthly: 8.5,
  source_url: null,
  last_verified_at: "2026-05-14 06:17:59",
  notes: null,
};

describe("mapApiToDbRow", () => {
  it("converte campi base correttamente", () => {
    const syncedAt = new Date("2026-05-17T10:00:00Z");
    const row = mapApiToDbRow(SAMPLE, syncedAt);
    expect(row.external_id).toBe("ep-offer-810001");
    expect(row.source).toBe("energiapro_commerciali");
    expect(row.offer_code).toBe(SAMPLE.offer_code);
    expect(row.supplier).toBe("Acea Energia");
    expect(row.supplier_logo_url).toBe("https://energiapro.biz/logos/acea.png");
    expect(row.commodity).toBe("electricity");
    expect(row.price_value).toBe(0.135);
    expect(row.price_unit).toBe("€/kWh");
    expect(row.is_active).toBe(true);
    expect(row.synced_at).toBe("2026-05-17T10:00:00.000Z");
    expect(row.fixed_cost_monthly).toBe(8.5);
  });

  it("fixed_cost_monthly: null -> null nel row DB", () => {
    const o: EnergiaProOffer = { ...SAMPLE, fixed_cost_monthly: null };
    const row = mapApiToDbRow(o, new Date());
    expect(row.fixed_cost_monthly).toBeNull();
  });

  it("parse last_verified_at non-ISO come UTC", () => {
    const row = mapApiToDbRow(SAMPLE, new Date());
    expect(row.last_verified_at).toBe("2026-05-14T06:17:59.000Z");
  });

  it("gestisce campi null", () => {
    const o: EnergiaProOffer = { ...SAMPLE, supplier_logo_url: null, last_verified_at: null, notes: null };
    const row = mapApiToDbRow(o, new Date());
    expect(row.supplier_logo_url).toBeNull();
    expect(row.last_verified_at).toBeNull();
    expect(row.notes).toBeNull();
  });
});
