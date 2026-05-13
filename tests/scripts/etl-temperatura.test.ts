/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { TemperaturaIngestor, weightedAverage, CITIES } from "@/scripts/etl-temperatura";

describe("TemperaturaIngestor", () => {
  it("pesi delle citta' sommano a 1.00 (entro 0.001)", () => {
    const sum = CITIES.reduce((acc, c) => acc + c.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.001);
  });

  it("weightedAverage calcola media pesata", () => {
    const result = weightedAverage([
      { weight: 0.5, value: 10 },
      { weight: 0.5, value: 20 },
    ]);
    expect(result).toBe(15);
  });

  it("weightedAverage gestisce array vuoto ritornando null", () => {
    expect(weightedAverage([])).toBeNull();
  });

  it("parse aggrega per data le risposte multi-citta'", () => {
    const ing = new TemperaturaIngestor();
    const raw = [
      { city: "milano", weight: 0.5, rows: [
        { date: "2026-05-12", tavg: 18 },
        { date: "2026-05-13", tavg: 20 },
      ]},
      { city: "roma", weight: 0.5, rows: [
        { date: "2026-05-12", tavg: 22 },
        { date: "2026-05-13", tavg: 24 },
      ]},
    ];
    const parsed = ing.parse(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].value).toBe(20);
    expect(parsed[1].value).toBe(22);
  });
});
