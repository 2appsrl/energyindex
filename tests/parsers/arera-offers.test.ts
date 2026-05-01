import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import {
  parsePlacetElectric,
  parsePlacetGas,
  statsFor,
  buildPlacetUrl,
  buildMliberoUrl,
} from "../../spikes/arera-offers.js";

const FIX_E = "spikes/samples/fixtures/arera-offers-placet-e-fixture.csv";
const FIX_G = "spikes/samples/fixtures/arera-offers-placet-g-fixture.csv";

describe("ARERA Portale Offerte — URL builders", () => {
  it("builds PLACET E offerte URL with month-no-zero in path and full date in filename", () => {
    expect(buildPlacetUrl("2026-05-01", "E_offerte")).toBe(
      "https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerte/2026_5/PO_Offerte_E_PLACET_20260501.csv",
    );
  });

  it("builds PLACET URL for a date in a single-digit month (April => 2026_4)", () => {
    expect(buildPlacetUrl("2026-04-15", "G_offerte")).toBe(
      "https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerte/2026_4/PO_Offerte_G_PLACET_20260415.csv",
    );
  });

  it("builds PLACET URL for a date in a double-digit month (October => 2026_10)", () => {
    expect(buildPlacetUrl("2026-10-31", "E_parametri")).toBe(
      "https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/parametri/2026_10/PO_Parametri_E_20261031.csv",
    );
  });

  it("builds Mercato Libero XML URL with the same month/year convention", () => {
    expect(buildMliberoUrl("2026-05-01", "E")).toBe(
      "https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerteML/2026_5/PO_Offerte_E_MLIBERO_20260501.xml",
    );
    expect(buildMliberoUrl("2026-05-01", "D")).toBe(
      "https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerteML/2026_5/PO_Offerte_D_MLIBERO_20260501.xml",
    );
  });
});

describe("parsePlacetElectric", () => {
  it("parses 6 offers from the fixture (3 fisse + 3 variabili)", async () => {
    const raw = await readFile(FIX_E, "utf-8");
    const offers = parsePlacetElectric(raw);
    expect(offers).toHaveLength(6);
    const fisse = offers.filter((o) => o.tipo_offerta === "prezzo fisso");
    const variabili = offers.filter((o) => o.tipo_offerta === "prezzo variabile");
    expect(fisse).toHaveLength(3);
    expect(variabili).toHaveLength(3);
  });

  it("for prezzo fisso offers, uses p_vol_mono as the comparable energy price", async () => {
    const raw = await readFile(FIX_E, "utf-8");
    const offers = parsePlacetElectric(raw);
    const fisse = offers.filter((o) => o.tipo_offerta === "prezzo fisso");
    // Valori dalla fixture (presi 1:1 da feed reale 2026-05-01):
    // 1.173700, 0.760590, 0.550000
    const prezzi = fisse.map((o) => o.prezzo_energia).sort((a, b) => a - b);
    expect(prezzi[0]).toBeCloseTo(0.55, 6);
    expect(prezzi[1]).toBeCloseTo(0.76059, 6);
    expect(prezzi[2]).toBeCloseTo(1.1737, 6);
  });

  it("for prezzo variabile offers, uses alpha as the comparable spread", async () => {
    const raw = await readFile(FIX_E, "utf-8");
    const offers = parsePlacetElectric(raw);
    const variabili = offers
      .filter((o) => o.tipo_offerta === "prezzo variabile")
      .map((o) => o.prezzo_energia)
      .sort((a, b) => a - b);
    // alpha values from fixture: 0.066000, 0.055000, 0.110000
    expect(variabili[0]).toBeCloseTo(0.055, 6);
    expect(variabili[1]).toBeCloseTo(0.066, 6);
    expect(variabili[2]).toBeCloseTo(0.11, 6);
  });

  it("captures vendor identity and offer code", async () => {
    const raw = await readFile(FIX_E, "utf-8");
    const offers = parsePlacetElectric(raw);
    expect(offers[0].vendor).toBe("Vendor Alpha srl");
    expect(offers[0].codice).toBe("FIXTURE_E_F_001");
  });

  it("rejects rows whose field count does not match the header", () => {
    const broken = [
      "denominazione,codice_fiscale,p_iva,url_sito_venditore,telefono,nome_offerta,cod_offerta,url_offerta,modalita_attivazione,modalita_pagamento,data_inizio,data_fine,tipo_cliente,tipo_offerta,p_fix_f,p_fix_v,p_vol_f1,p_vol_f2,p_vol_f3,p_vol_bf1,p_vol_bf23,p_vol_mono,alpha,regione,provincia,comune",
      "too,few,fields",
    ].join("\n");
    expect(() => parsePlacetElectric(broken)).toThrow(/3 campi/);
  });
});

describe("parsePlacetGas", () => {
  it("parses 4 offers with 21-column schema", async () => {
    const raw = await readFile(FIX_G, "utf-8");
    const offers = parsePlacetGas(raw);
    expect(offers).toHaveLength(4);
  });

  it("for prezzo fisso, uses p_vol; for prezzo variabile, uses alpha", async () => {
    const raw = await readFile(FIX_G, "utf-8");
    const offers = parsePlacetGas(raw);
    const fisse = offers.filter((o) => o.tipo_offerta === "prezzo fisso");
    const variabili = offers.filter((o) => o.tipo_offerta === "prezzo variabile");
    // p_vol fisso: 4.000000, 2.507910
    expect(fisse.map((o) => o.prezzo_energia).sort((a, b) => a - b)).toEqual([
      2.50791, 4,
    ]);
    // alpha variabile: 0.900000, 0.100000
    expect(variabili.map((o) => o.prezzo_energia).sort((a, b) => a - b)).toEqual([
      0.1, 0.9,
    ]);
  });
});

describe("statsFor (quartile aggregator)", () => {
  it("computes p25/median/p75 with linear interpolation on the fixture", async () => {
    const raw = await readFile(FIX_E, "utf-8");
    const offers = parsePlacetElectric(raw);
    const variabili = offers.filter((o) => o.tipo_offerta === "prezzo variabile");
    const stats = statsFor(variabili);
    // sorted alpha values: 0.055, 0.066, 0.110 (n=3)
    expect(stats.n).toBe(3);
    expect(stats.min).toBeCloseTo(0.055, 6);
    expect(stats.median).toBeCloseTo(0.066, 6);
    expect(stats.max).toBeCloseTo(0.11, 6);
    // p25 = interp at pos 0.5 between 0.055 and 0.066 = 0.0605
    expect(stats.p25).toBeCloseTo(0.0605, 6);
    // p75 = interp at pos 1.5 between 0.066 and 0.110 = 0.088
    expect(stats.p75).toBeCloseTo(0.088, 6);
  });

  it("handles empty input gracefully", () => {
    const stats = statsFor([]);
    expect(stats.n).toBe(0);
    expect(stats.min).toBeNaN();
    expect(stats.median).toBeNaN();
  });
});
