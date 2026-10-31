/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { findAttribution, WIDGET_VARIANTS, formatEuro, readModel } from "@/lib/widget/core";

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.querySelector(".eidx-widget") as HTMLElement;
}
const visible = () => true;

describe("findAttribution", () => {
  it("trova un link visibile a energyindex.it con testo", () => {
    const el = mount('<div class="eidx-widget"><p>Fonte: <a href="https://energyindex.it">Energy Index</a></p></div>');
    expect(findAttribution(el, visible)).not.toBeNull();
  });
  it("null se il link manca, punta altrove o non ha testo", () => {
    expect(findAttribution(mount('<div class="eidx-widget"><p>Fonte: Energy Index</p></div>'), visible)).toBeNull();
    expect(findAttribution(mount('<div class="eidx-widget"><a href="https://altro.it">Energy Index</a></div>'), visible)).toBeNull();
    expect(findAttribution(mount('<div class="eidx-widget"><a href="https://energyindex.it"> </a></div>'), visible)).toBeNull();
  });
  it("null se il link e' nascosto", () => {
    const el = mount('<div class="eidx-widget"><a href="https://energyindex.it">Energy Index</a></div>');
    expect(findAttribution(el, () => false)).toBeNull();
  });
});

describe("WIDGET_VARIANTS", () => {
  it("le varianti GME richiedono la riga di fonte GME", () => {
    expect(WIDGET_VARIANTS.pun.gme).toBe(true);
    expect(WIDGET_VARIANTS.psv.gme).toBe(true);
    expect(WIDGET_VARIANTS["indice-luce"].gme).toBe(false);
  });
});

describe("formatEuro", () => {
  it("formato italiano con unita'", () => {
    expect(formatEuro(274.04, "€/MWh", 2)).toBe("274,04 €/MWh");
    expect(formatEuro(0.129, "€/kWh", 3)).toBe("0,129 €/kWh");
  });
});

describe("readModel", () => {
  it("PUN: media del giorno da daily_average", () => {
    const m = readModel("pun", { daily_average: { date: "2026-10-30", value_native: 274.04, unit_native: "€/MWh" } });
    expect(m).toEqual({ title: "PUN medio", rows: [{ label: "30/10/2026", value: "274,04 €/MWh" }] });
  });
  it("indice luce: fisso come prezzo, variabile come spread sull'indice", () => {
    const m = readModel("indice-luce", { indices: [
      { slug: "mercato-libero-luce-variabile", median: 0.055, unit: "€/kWh", date: "2026-10-30", basis: "spread", reference: "PUN" },
      { slug: "mercato-libero-luce-fissa", median: 0.3495, unit: "€/kWh", date: "2026-10-30", basis: "prezzo" },
    ] });
    expect(m?.rows).toEqual([
      { label: "Prezzo fisso", value: "0,350 €/kWh" },
      { label: "Prezzo variabile", value: "PUN + 0,055 €/kWh" },
    ]);
    expect(m?.date).toBe("30/10/2026");
  });
  it("spread negativo: segno meno, non '+ -'", () => {
    const m = readModel("indice-gas", { indices: [
      { slug: "mercato-libero-gas-variabile", median: -0.012, unit: "€/Smc", date: "2026-10-30", basis: "spread", reference: "PSV" },
    ] });
    expect(m?.rows).toEqual([{ label: "Prezzo variabile", value: "PSV - 0,012 €/Smc" }]);
  });
  it("risposta inattesa: null", () => {
    expect(readModel("pun", {})).toBeNull();
  });
});
