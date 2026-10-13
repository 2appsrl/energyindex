import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { htmlToText, parseItNumber, slugify } from "../../scripts/lib/brand-scrapers/types";
import { parseOctopus } from "../../scripts/lib/brand-scrapers/octopus";
import { parsePulsee } from "../../scripts/lib/brand-scrapers/pulsee";
import { parseIllumia } from "../../scripts/lib/brand-scrapers/illumia";

const FIX = "tests/fixtures/brand-offers";

async function textOf(file: string): Promise<string> {
  return htmlToText(await readFile(`${FIX}/${file}`, "utf-8"));
}

describe("helpers", () => {
  it("parseItNumber gestisce virgola e migliaia", () => {
    expect(parseItNumber("0,165")).toBeCloseTo(0.165);
    expect(parseItNumber("1.234,5")).toBeCloseTo(1234.5);
  });
  it("slugify normalizza accenti e spazi", () => {
    expect(slugify("Energia FiXXa Luce")).toBe("energia-fixxa-luce");
    expect(slugify("Gas Relax")).toBe("gas-relax");
  });
});

describe("parseOctopus (fixture reale ott 2026)", () => {
  it("estrae fisse e variabili, scarta le PLACET", async () => {
    const offers = parseOctopus(await textOf("octopus-tariffe.html"));
    expect(offers.length).toBeGreaterThanOrEqual(4);
    expect(offers.every((o) => !/placet/i.test(o.offerName))).toBe(true);

    const fissaLuce = offers.find(
      (o) => o.commodity === "electricity" && o.priceType === "fisso",
    );
    expect(fissaLuce?.priceValue).toBeCloseTo(0.165);
    expect(fissaLuce?.fixedCostMonthly).toBe(6);
    expect(fissaLuce?.offerName).toContain("Octopus Fissa");

    const flexLuce = offers.find(
      (o) => o.commodity === "electricity" && o.priceType === "variabile",
    );
    expect(flexLuce?.priceValue).toBeCloseTo(0.0088);
    expect(flexLuce?.offerName).toContain("Flex");

    const flexGas = offers.find(
      (o) => o.commodity === "gas" && o.priceType === "variabile",
    );
    expect(flexGas?.priceValue).toBeCloseTo(0.06);

    const fissaGas = offers.find(
      (o) => o.commodity === "gas" && o.priceType === "fisso",
    );
    expect(fissaGas?.priceValue).toBeCloseTo(0.69);
    expect(fissaGas?.fixedCostMonthly).toBe(7);
  });

  it("externalId univoci e stabili", async () => {
    const offers = parseOctopus(await textOf("octopus-tariffe.html"));
    const ids = offers.map((o) => o.externalId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("octopus-"))).toBe(true);
  });
});

describe("parsePulsee (fixture reale ott 2026)", () => {
  it("estrae le Relax luce e gas, scarta PLACET e variabile+tetto", async () => {
    const offers = parsePulsee([
      await textOf("pulsee-luce.html"),
      await textOf("pulsee-gas.html"),
    ]);
    expect(offers.length).toBeGreaterThanOrEqual(3);
    expect(offers.every((o) => !/placet/i.test(o.offerName))).toBe(true);
    // Limit.e e' variabile + tetto: il numero in pagina e' il cap, va scartata
    expect(offers.every((o) => !/limit/i.test(o.offerName))).toBe(true);

    const relax36 = offers.find((o) => /Relax 36/i.test(o.offerName));
    expect(relax36?.commodity).toBe("electricity");
    expect(relax36?.priceType).toBe("fisso");
    expect(relax36?.priceValue).toBeCloseTo(0.15);
    expect(relax36?.fixedCostMonthly).toBe(12); // 144 €/anno

    const relax24 = offers.find((o) => /Relax 24/i.test(o.offerName));
    expect(relax24?.priceValue).toBeCloseTo(0.182);

    const gasRelax = offers.find((o) => o.commodity === "gas");
    expect(gasRelax?.priceValue).toBeCloseTo(0.801);
  });
});

describe("parseIllumia (fixture reali ott 2026)", () => {
  it("estrae FiXXa luce e il bundle Rossa luce+gas", async () => {
    const offers = parseIllumia([
      await textOf("illumia-fixxa.html"),
      await textOf("illumia-rossa.html"),
    ]);
    expect(offers).toHaveLength(3);

    const fixxa = offers.find((o) => /FiXXa/i.test(o.offerName));
    expect(fixxa?.priceValue).toBeCloseTo(0.12);
    expect(fixxa?.fixedCostMonthly).toBeCloseTo(1.66);

    const rossaLuce = offers.find(
      (o) => /Rossa/i.test(o.offerName) && o.commodity === "electricity",
    );
    expect(rossaLuce?.priceValue).toBeCloseTo(0.135);
    expect(rossaLuce?.fixedCostMonthly).toBeCloseTo(7);

    const rossaGas = offers.find(
      (o) => /Rossa/i.test(o.offerName) && o.commodity === "gas",
    );
    expect(rossaGas?.priceValue).toBeCloseTo(0.75);
  });
});
