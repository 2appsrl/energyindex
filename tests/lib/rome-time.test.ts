/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  romeHourToIso,
  romeDayBoundsUtc,
  romeDateOf,
  romeHourOf,
} from "../../supabase/functions/_shared/rome-time.js";

describe("romeHourToIso (ora GME 1..25 → istante UTC)", () => {
  it("giorno d'inverno: ora 1 = 00:00 CET = 23:00Z del giorno prima", () => {
    expect(romeHourToIso("2026-10-30", 1)).toBe("2026-10-29T23:00:00.000Z");
    expect(romeHourToIso("2026-10-30", 24)).toBe("2026-10-30T22:00:00.000Z");
  });

  it("giorno d'estate: ora 1 = 00:00 CEST = 22:00Z del giorno prima", () => {
    expect(romeHourToIso("2026-07-15", 1)).toBe("2026-07-14T22:00:00.000Z");
    expect(romeHourToIso("2026-07-15", 24)).toBe("2026-07-15T21:00:00.000Z");
  });

  it("25 ottobre 2026 (25 ore): ore consecutive senza collisioni", () => {
    const hours = Array.from({ length: 25 }, (_, i) => romeHourToIso("2026-10-25", i + 1));
    expect(hours[0]).toBe("2026-10-24T22:00:00.000Z");
    expect(hours[24]).toBe("2026-10-25T22:00:00.000Z");
    expect(new Set(hours).size).toBe(25);
    // l'ora 25 del 25/10 non deve coincidere con l'ora 1 del 26/10
    expect(romeHourToIso("2026-10-26", 1)).toBe("2026-10-25T23:00:00.000Z");
  });

  it("29 marzo 2026 (23 ore): l'ora 23 chiude la giornata", () => {
    expect(romeHourToIso("2026-03-29", 1)).toBe("2026-03-28T23:00:00.000Z");
    expect(romeHourToIso("2026-03-29", 23)).toBe("2026-03-29T21:00:00.000Z");
    expect(romeHourToIso("2026-03-30", 1)).toBe("2026-03-29T22:00:00.000Z");
  });
});

describe("romeDayBoundsUtc", () => {
  it("giorno normale d'inverno dura 24 ore", () => {
    const { start, end } = romeDayBoundsUtc("2026-10-30");
    expect(start).toBe("2026-10-29T23:00:00.000Z");
    expect(end).toBe("2026-10-30T23:00:00.000Z");
  });

  it("giorno del cambio d'ora d'autunno dura 25 ore", () => {
    const { start, end } = romeDayBoundsUtc("2026-10-25");
    expect(start).toBe("2026-10-24T22:00:00.000Z");
    expect(end).toBe("2026-10-25T23:00:00.000Z");
  });
});

describe("romeDateOf", () => {
  it("23:30Z d'inverno e' gia' il giorno dopo in Italia", () => {
    expect(romeDateOf("2026-10-29T23:30:00Z")).toBe("2026-10-30");
  });
  it("22:30Z d'inverno e' ancora lo stesso giorno", () => {
    expect(romeDateOf("2026-10-29T22:30:00Z")).toBe("2026-10-29");
  });
  it("22:30Z d'estate e' gia' il giorno dopo", () => {
    expect(romeDateOf("2026-07-14T22:30:00Z")).toBe("2026-07-15");
  });
});

describe("romeHourOf (istante UTC → ora GME 1..25)", () => {
  it("inverno: 22:00Z = ora 24, 23:00Z = ora 1 del giorno dopo", () => {
    expect(romeHourOf("2026-10-30T22:00:00Z")).toBe(24);
    expect(romeHourOf("2026-10-30T23:00:00Z")).toBe(1);
  });
  it("estate: 21:00Z = ora 24", () => {
    expect(romeHourOf("2026-07-15T21:00:00Z")).toBe(24);
  });
  it("25 ottobre 2026: l'ultima ora e' la 25", () => {
    expect(romeHourOf("2026-10-25T22:00:00Z")).toBe(25);
  });
  it("e' l'inverso di romeHourToIso", () => {
    expect(romeHourOf(romeHourToIso("2026-03-29", 23))).toBe(23);
  });
});
