import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parseGmePsv } from "../../spikes/gme-psv.js";

const FIXTURE = "spikes/samples/fixtures/gme-psv-fixture.json";

describe("parseGmePsv", () => {
  it("parses daily PSV values from real GME sample", async () => {
    const raw = await readFile(FIXTURE, "utf-8");
    const result = parseGmePsv(raw);
    expect(result.points.length).toBeGreaterThanOrEqual(1);
    result.points.forEach((p) => {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.value).toBeGreaterThan(5);
      expect(p.value).toBeLessThan(200);
    });
  });

  it("returns delivery dates in strictly ascending order, no duplicates", async () => {
    // Il parser dedupica per data di consegna e ordina crescente: questo è il
    // contratto su cui si appoggerà il loader di Energy Index per fare upsert.
    const raw = await readFile(FIXTURE, "utf-8");
    const result = parseGmePsv(raw);
    const dates = result.points.map((p) => p.date);
    const sorted = dates.slice().sort();
    expect(dates).toEqual(sorted);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("tolerates empty trading sessions (no crash on rows=0)", async () => {
    // Nel fixture la sessione 2026-05-01 ha rows=[] perché al momento del fetch
    // l'asta del giorno non era ancora chiusa. Il parser deve semplicemente
    // saltare quelle sessioni e tornare i punti delle sessioni con dati.
    const raw = await readFile(FIXTURE, "utf-8");
    const sample = JSON.parse(raw);
    const empties = sample.sessions.filter(
      (s: { rows: unknown[] }) => s.rows.length === 0,
    );
    expect(empties.length).toBeGreaterThanOrEqual(1);
    const result = parseGmePsv(raw);
    // Almeno una sessione popolata -> almeno un punto.
    expect(result.points.length).toBeGreaterThanOrEqual(1);
  });
});
