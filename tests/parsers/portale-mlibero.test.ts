import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import {
  parseMliberoXml,
  dominantVarIdx,
  buildMliberoXmlUrl,
} from "../../scripts/lib/portale-mlibero";

const FIX = "tests/fixtures/brand-offers";

describe("buildMliberoXmlUrl", () => {
  it("mese senza zero nel path, data compatta nel filename", () => {
    expect(buildMliberoXmlUrl("2026-10-12", "E")).toBe(
      "https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerteML/2026_10/PO_Offerte_E_MLIBERO_20261012.xml",
    );
    expect(buildMliberoXmlUrl("2026-04-05", "G")).toContain("/2026_4/PO_Offerte_G_MLIBERO_20260405.xml");
  });
});

describe("parseMliberoXml electricity (fixture reale ott 2026)", () => {
  it("estrae le offerte domestiche con prezzi coerenti col sito del brand", async () => {
    const xml = await readFile(`${FIX}/portale-mlibero-e.xml`, "utf-8");
    const offers = parseMliberoXml(xml, "electricity", ["12"]);

    // Validazione incrociata con lo scraping del sito Octopus:
    const fissa = offers.find((o) => o.offerName === "Octopus Fissa 24M");
    expect(fissa?.priceType).toBe("fisso");
    expect(fissa?.priceValue).toBeCloseTo(0.165);
    expect(fissa?.fixedCostMonthly).toBeCloseTo(6); // 72 €/anno
    expect(fissa?.supplierDomain).toBe("octopusenergy.it");

    const flex = offers.find((o) => o.offerName === "Octopus Flex");
    expect(flex?.priceType).toBe("variabile");
    expect(flex?.priceValue).toBeCloseTo(0.0088);
    expect(flex?.idxPrezzo).toBe("12");
  });

  it("scarta business e filtra le variabili per indice", async () => {
    const xml = await readFile(`${FIX}/portale-mlibero-e.xml`, "utf-8");
    // La fixture contiene 1 blocco business (sempre escluso) e 1 variabile
    // idx=01 ("SPREAD SU PUN" con macroarea 04): col filtro ["12"] e' fuori,
    // con ["12","01"] (default ETL) rientra.
    const strict = parseMliberoXml(xml, "electricity", ["12"]);
    const etlDefault = parseMliberoXml(xml, "electricity", ["12", "01"]);
    expect(etlDefault.length).toBe(strict.length + 1);
    const smart = etlDefault.find((o) => /SMART 3/i.test(o.offerName));
    expect(smart?.priceValue).toBeCloseTo(0.02);
    expect(smart?.fixedCostMonthly).toBeCloseTo(110 / 12, 2);
  });

  it("media le fasce per i fissi multiorari", async () => {
    const xml = await readFile(`${FIX}/portale-mlibero-e.xml`, "utf-8");
    const offers = parseMliberoXml(xml, "electricity", ["12"]);
    const multi = offers.filter((o) => o.offerName !== "Octopus Fissa 24M" && o.priceType === "fisso");
    for (const o of multi) {
      expect(o.priceValue).toBeGreaterThan(0);
      expect(o.priceValue).toBeLessThan(1); // €/kWh plausibile
    }
  });

  it("valid_to in formato ISO", async () => {
    const xml = await readFile(`${FIX}/portale-mlibero-e.xml`, "utf-8");
    const flex = parseMliberoXml(xml, "electricity", ["12"]).find(
      (o) => o.offerName === "Octopus Flex",
    );
    expect(flex?.validTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("parseMliberoXml gas (fixture reale ott 2026)", () => {
  it("estrae fisso e variabile gas col filtro sull'indice dominante", async () => {
    const xml = await readFile(`${FIX}/portale-mlibero-g.xml`, "utf-8");
    const idx = dominantVarIdx(xml);
    const offers = parseMliberoXml(xml, "gas", idx ? [idx] : null);

    const fisso = offers.find((o) => o.priceType === "fisso" && /octopus/i.test(o.supplierDomain ?? ""));
    expect(fisso?.priceValue).toBeCloseTo(0.69); // = sito Octopus
    expect(fisso?.fixedCostMonthly).toBeCloseTo(7); // 84 €/anno

    const varie = offers.filter((o) => o.priceType === "variabile");
    expect(varie.length).toBeGreaterThanOrEqual(1);
    expect(varie.every((o) => o.priceValue >= 0 && o.priceValue < 2)).toBe(true);
  });
});
