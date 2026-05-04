import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parseEntsoeDayAhead } from "../../spikes/entsoe-dayahead.js";

const FIXTURE = "spikes/samples/fixtures/entsoe-de-fixture.xml";

describe("parseEntsoeDayAhead", () => {
  it("parses day-ahead prices from real ENTSO-E sample (DE-LU)", async () => {
    const xml = await readFile(FIXTURE, "utf-8");
    const result = parseEntsoeDayAhead(xml);
    // ENTSO-E ha migrato il day-ahead da PT60M (24 punti) a PT15M (96 punti) nel 2025.
    // Tolleriamo entrambi i regimi + DST (-1 / +1):
    //   PT60M: 23..25, PT15M: 92..100, blocchi compressi (curveType A03): >=23.
    expect(result.points.length).toBeGreaterThanOrEqual(23);
    expect(result.points.length).toBeLessThanOrEqual(100);
    result.points.forEach((p) => {
      expect(p.position).toBeGreaterThanOrEqual(1);
      // Range plausibile per il day-ahead europeo: -200..2000 €/MWh
      // (negativi = eccesso rinnovabili; picchi alti = scarsezza/freddo).
      expect(p.price).toBeGreaterThan(-200);
      expect(p.price).toBeLessThan(2000);
    });
  });

  it("preserves price ordering by position", async () => {
    const xml = await readFile(FIXTURE, "utf-8");
    const { points } = parseEntsoeDayAhead(xml);
    const positions = points.map((p) => p.position);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("exposes correct currency and unit for DE-LU day-ahead", async () => {
    const xml = await readFile(FIXTURE, "utf-8");
    const result = parseEntsoeDayAhead(xml);
    expect(result.currency).toBe("EUR");
    expect(result.unit).toMatch(/MWH/i);
    // domain deve essere l'EIC della Germania-Lussemburgo
    expect(result.domain).toBe("10Y1001A1001A82H");
    // resolution e` PT15M (post-2025) o PT60M (pre-2025) — ISO 8601 duration
    expect(result.resolution).toMatch(/^PT(15|30|60)M$/);
  });
});
