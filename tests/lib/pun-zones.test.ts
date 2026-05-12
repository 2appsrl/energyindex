import { describe, it, expect } from "vitest";
import {
  PUN_ZONES,
  resolveZone,
  type ZoneCode,
} from "@/lib/pun-zones";

describe("resolveZone", () => {
  it("returns national zone when input is undefined", () => {
    const z = resolveZone(undefined);
    expect(z.code).toBe("nazionale");
    expect(z.slug).toBe("pun");
    expect(z.isNational).toBe(true);
  });

  it("returns national zone when input is invalid", () => {
    expect(resolveZone("foo").code).toBe("nazionale");
    expect(resolveZone("").code).toBe("nazionale");
  });

  it("accepts all 6 valid zone codes", () => {
    const codes: ZoneCode[] = ["nord", "cnor", "csud", "sud", "sici", "sard"];
    for (const c of codes) {
      const z = resolveZone(c);
      expect(z.code).toBe(c);
      expect(z.isNational).toBe(false);
    }
  });

  it("maps codes to correct DB slugs", () => {
    expect(resolveZone("nord").slug).toBe("pun-zona-nord");
    expect(resolveZone("cnor").slug).toBe("pun-zona-cnor");
    expect(resolveZone("csud").slug).toBe("pun-zona-csud");
    expect(resolveZone("sud").slug).toBe("pun-zona-sud");
    expect(resolveZone("sici").slug).toBe("pun-zona-sici");
    expect(resolveZone("sard").slug).toBe("pun-zona-sard");
  });

  it("exposes PUN_ZONES with national first then 6 physical zones", () => {
    expect(PUN_ZONES.map((z) => z.code)).toEqual([
      "nazionale", "nord", "cnor", "csud", "sud", "sici", "sard",
    ]);
  });

  it("each zone has displayName and displayShort", () => {
    for (const z of PUN_ZONES) {
      expect(z.displayName.length).toBeGreaterThan(0);
      expect(z.displayShort.length).toBeGreaterThan(0);
    }
  });
});
