/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { BrentIngestor } from "@/scripts/etl-brent";
import fixture from "../fixtures/eia-brent.json";

describe("BrentIngestor.parse", () => {
  it("converte response EIA in Observation[] con date a mezzogiorno UTC", () => {
    const ing = new BrentIngestor();
    const parsed = ing.parse(fixture.response.data);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].observed_at.toISOString()).toBe("2026-05-12T12:00:00.000Z");
    expect(parsed[0].value).toBe(68.42);
    expect(parsed[1].value).toBe(69.10);
  });

  it("salta righe con value nullo o invalido", () => {
    const ing = new BrentIngestor();
    const parsed = ing.parse([
      { period: "2026-05-12", value: "68.42" },
      { period: "2026-05-13", value: null },
      { period: "2026-05-14", value: "abc" },
    ]);
    expect(parsed).toHaveLength(1);
  });
});
