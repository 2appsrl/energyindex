/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { buildEnergyIndexJson, latestPerSlug } from "@/lib/api/energy-index";

const rows = [
  { aggregate_slug: "mercato-libero-luce-fissa", computed_at: "2026-10-30", median: "0.129", p25: "0.115", p75: "0.141", min: "0.0989", max: "0.1995", sample_size: 212, spread_vs_reference_pct: null, unit: "€/kWh" },
  { aggregate_slug: "mercato-libero-luce-fissa", computed_at: "2026-10-29", median: "0.130", p25: null, p75: null, min: "0.1", max: "0.2", sample_size: 210, spread_vs_reference_pct: null, unit: "€/kWh" },
  { aggregate_slug: "mercato-libero-gas-variabile", computed_at: "2026-10-30", median: "0.52", p25: "0.49", p75: "0.56", min: "0.4", max: "0.7", sample_size: 180, spread_vs_reference_pct: "18.4", unit: "€/Smc" },
];

describe("latestPerSlug", () => {
  it("tiene solo lo snapshot piu' recente di ogni indice", () => {
    const latest = latestPerSlug(rows);
    expect(latest).toHaveLength(2);
    expect(latest.find((r) => r.aggregate_slug === "mercato-libero-luce-fissa")?.computed_at).toBe("2026-10-30");
  });
});

describe("buildEnergyIndexJson", () => {
  it("converte i numeric in numeri e usa i nomi Energy Index", () => {
    const j = buildEnergyIndexJson(latestPerSlug(rows));
    const luce = j.indices.find((i) => i.slug === "mercato-libero-luce-fissa")!;
    expect(luce).toMatchObject({ name: "Energy Index · Luce — Prezzo Fisso", median: 0.129, p25: 0.115, offers: 212, date: "2026-10-30" });
    expect(luce.spread_vs_reference_pct).toBeUndefined();
  });

  it("include lo spread solo per le variabili", () => {
    const j = buildEnergyIndexJson(latestPerSlug(rows));
    expect(j.indices.find((i) => i.slug === "mercato-libero-gas-variabile")!.spread_vs_reference_pct).toBe(18.4);
  });

  it("filtra per commodity", () => {
    const j = buildEnergyIndexJson(latestPerSlug(rows), "gas");
    expect(j.indices.map((i) => i.slug)).toEqual(["mercato-libero-gas-variabile"]);
  });

  it("attribuzione Energy Index con fonte ARERA, data = snapshot piu' recente", () => {
    const j = buildEnergyIndexJson(latestPerSlug(rows));
    expect(j.attribution).toContain("Energy Index");
    expect(j.attribution).toContain("ARERA");
    expect(j.updated_at).toBe("2026-10-30");
  });
});
