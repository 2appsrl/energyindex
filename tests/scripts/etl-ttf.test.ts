/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { TTFIngestor } from "@/scripts/etl-ttf";
import fixture from "../fixtures/yahoo-ttf.json";

describe("TTFIngestor.parse", () => {
  it("converte response Yahoo in Observation[] (mezzogiorno UTC)", () => {
    const ing = new TTFIngestor();
    const parsed = ing.parse(fixture);
    // Fixture: 3 timestamps, 1 close è null → 2 record parsed
    expect(parsed).toHaveLength(2);
    expect(parsed[0].observed_at.getUTCHours()).toBe(12);
    expect(parsed[0].value).toBe(29.10);
    expect(parsed[1].value).toBe(30.45);
  });

  it("salta close null o non-finite", () => {
    const ing = new TTFIngestor();
    const raw = {
      chart: {
        result: [
          {
            meta: { currency: "EUR" },
            timestamp: [1715644800, 1715731200, 1715817600],
            indicators: { quote: [{ close: [29.1, null, Number.NaN] }] },
          },
        ],
        error: null,
      },
    };
    expect(ing.parse(raw)).toHaveLength(1);
  });

  it("throw se Yahoo ritorna error block", () => {
    const ing = new TTFIngestor();
    const raw = {
      chart: {
        result: null,
        error: { code: "Not Found", description: "symbol may be delisted" },
      },
    };
    expect(() => ing.parse(raw)).toThrow(/Not Found/);
  });

  it("throw se currency non e' EUR (sanity check)", () => {
    const ing = new TTFIngestor();
    const raw = {
      chart: {
        result: [
          {
            meta: { currency: "USD" },
            timestamp: [1715644800],
            indicators: { quote: [{ close: [50] }] },
          },
        ],
        error: null,
      },
    };
    expect(() => ing.parse(raw)).toThrow(/currency/i);
  });

  it("result vuoto torna array vuoto (no throw)", () => {
    const ing = new TTFIngestor();
    expect(ing.parse({ chart: { result: [], error: null } })).toEqual([]);
  });
});
