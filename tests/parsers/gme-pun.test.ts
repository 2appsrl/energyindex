import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parseGmePun } from "../../supabase/functions/_shared/parsers/gme-pun.js";

const FIXTURE = "spikes/samples/fixtures/gme-pun-fixture.json";

describe("parseGmePun", () => {
  it("parses 24 hourly PUN values from real GME sample", async () => {
    const raw = await readFile(FIXTURE, "utf-8");
    const result = parseGmePun(raw);
    expect(result.pun_national).toHaveLength(24);
    result.pun_national.forEach((p) => {
      expect(p.value).toBeGreaterThan(-100);
      expect(p.value).toBeLessThan(2000);
    });
  });

  it("parses 6 zonal series (NORD, CNOR, CSUD, SUD, SICI, SARD)", async () => {
    const raw = await readFile(FIXTURE, "utf-8");
    const result = parseGmePun(raw);
    expect(Object.keys(result.zonal).sort()).toEqual([
      "CNOR",
      "CSUD",
      "NORD",
      "SARD",
      "SICI",
      "SUD",
    ]);
    for (const code of ["NORD", "CNOR", "CSUD", "SUD", "SICI", "SARD"] as const) {
      expect(result.zonal[code]).toHaveLength(24);
    }
  });

  it("returns hours sorted 1..24 in each series", async () => {
    const raw = await readFile(FIXTURE, "utf-8");
    const result = parseGmePun(raw);
    const expected = Array.from({ length: 24 }, (_, i) => i + 1);
    expect(result.pun_national.map((p) => p.hour)).toEqual(expected);
    for (const code of ["NORD", "CNOR", "CSUD", "SUD", "SICI", "SARD"] as const) {
      expect(result.zonal[code].map((p) => p.hour)).toEqual(expected);
    }
  });

  it("preserves real zonal divergence — NORD vs SUD differ on this fixture day", async () => {
    // Apr 30 2026: giorno feriale con congestione zonale fra Nord (incl. CNOR) e Sud.
    // Se questo invariante regredisce vuol dire che il parser sta mescolando le zone.
    const raw = await readFile(FIXTURE, "utf-8");
    const result = parseGmePun(raw);
    const nordSum = result.zonal.NORD.reduce((s, p) => s + p.value, 0);
    const sudSum = result.zonal.SUD.reduce((s, p) => s + p.value, 0);
    expect(nordSum).not.toBe(sudSum);
  });
});
