/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { Co2Ingestor, parseEmber, parseInvesting } from "@/scripts/etl-co2";
import emberFixture from "../fixtures/ember-co2.json";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Co2Ingestor parsers", () => {
  it("parseEmber estrae date e price_eur", () => {
    const out = parseEmber(emberFixture.data);
    expect(out).toHaveLength(2);
    expect(out[0].observed_at.toISOString().slice(0, 10)).toBe("2026-05-12");
    expect(out[0].value).toBe(75.30);
  });

  it("parseInvesting estrae le righe da HTML investing-style", () => {
    const html = readFileSync(resolve(__dirname, "../fixtures/investing-co2.html"), "utf-8");
    const out = parseInvesting(html);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0].value).toBe(75.30);
  });
});

describe("Co2Ingestor.parse (entry-point)", () => {
  it("delega a parseEmber se il raw e' { data: [...] }", () => {
    const ing = new Co2Ingestor();
    const parsed = ing.parse(emberFixture);
    expect(parsed).toHaveLength(2);
  });
});
