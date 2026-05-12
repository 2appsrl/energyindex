import { describe, it, expect } from "vitest";
import {
  AGGREGATE_SLUGS,
  resolveAggregate,
  type AggregateSlug,
} from "@/lib/arera-aggregates";

describe("resolveAggregate", () => {
  it("returns 4 known aggregate definitions", () => {
    const slugs: AggregateSlug[] = [
      "mercato-libero-luce-fissa",
      "mercato-libero-luce-variabile",
      "mercato-libero-gas-fissa",
      "mercato-libero-gas-variabile",
    ];
    for (const s of slugs) {
      const a = resolveAggregate(s);
      expect(a.slug).toBe(s);
    }
  });

  it("maps luce-fissa to commodity=electricity, price_type=fisso, unit €/kWh, reference PUN", () => {
    const a = resolveAggregate("mercato-libero-luce-fissa");
    expect(a.commodity).toBe("electricity");
    expect(a.priceType).toBe("fisso");
    expect(a.unit).toBe("€/kWh");
    expect(a.referenceAssetSlug).toBe("pun");
  });

  it("maps gas-variabile to commodity=gas, price_type=variabile, unit €/Smc, reference PSV", () => {
    const a = resolveAggregate("mercato-libero-gas-variabile");
    expect(a.commodity).toBe("gas");
    expect(a.priceType).toBe("variabile");
    expect(a.unit).toBe("€/Smc");
    expect(a.referenceAssetSlug).toBe("psv");
  });

  it("AGGREGATE_SLUGS exposes the 4 slugs in display order (luce-fissa, luce-var, gas-fissa, gas-var)", () => {
    expect(AGGREGATE_SLUGS.map((a) => a.slug)).toEqual([
      "mercato-libero-luce-fissa",
      "mercato-libero-luce-variabile",
      "mercato-libero-gas-fissa",
      "mercato-libero-gas-variabile",
    ]);
  });

  it("each aggregate has a displayName", () => {
    for (const a of AGGREGATE_SLUGS) {
      expect(a.displayName.length).toBeGreaterThan(0);
    }
  });
});
