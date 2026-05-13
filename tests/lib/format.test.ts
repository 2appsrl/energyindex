import { describe, it, expect } from "vitest";
import {
  formatEurMwh,
  formatPercentDelta,
  formatRetailEquivalent,
} from "@/lib/format";

describe("formatEurMwh", () => {
  it("formatta con separatore decimale italiano e suffisso /MWh", () => {
    expect(formatEurMwh(127.09)).toMatch(/127,09.*\/MWh/);
  });
});

describe("formatPercentDelta", () => {
  it("usa ▲ per delta positivo", () => {
    expect(formatPercentDelta(110, 100)).toBe("▲ 10.0%");
  });
  it("usa ▼ per delta negativo", () => {
    expect(formatPercentDelta(90, 100)).toBe("▼ 10.0%");
  });
  it("ritorna em-dash se prev e' zero", () => {
    expect(formatPercentDelta(50, 0)).toBe("—");
  });
});

describe("formatRetailEquivalent", () => {
  it("converte PUN luce da €/MWh a €/kWh (4 decimali, separatore IT)", () => {
    // 127,09 €/MWh = 0,12709 €/kWh -> arrotondato 4dp = 0,1271
    expect(formatRetailEquivalent(127.09, "luce")).toBe("0,1271 €/kWh");
  });

  it("converte PSV gas da €/MWh a €/Smc (4 decimali, 1 Smc = 10,5275 kWh)", () => {
    // 45,98 €/MWh = 0,04598 €/kWh; * 10,5275 = 0,48405... -> 4dp = 0,4841
    expect(formatRetailEquivalent(45.98, "gas")).toBe("0,4841 €/Smc");
  });

  it("ritorna stringa vuota per commodity non riconosciute (degrada con grazia)", () => {
    // @ts-expect-error testing runtime fallback
    expect(formatRetailEquivalent(100, "biomassa")).toBe("");
  });

  it("gestisce valore zero senza crash", () => {
    expect(formatRetailEquivalent(0, "luce")).toBe("0,0000 €/kWh");
    expect(formatRetailEquivalent(0, "gas")).toBe("0,0000 €/Smc");
  });
});
