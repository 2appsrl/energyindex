/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { findAttribution, WIDGET_VARIANTS, formatEuro, readModel, isRenderedVisible } from "@/lib/widget/core";

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
  it("spread minuscolo o -0: niente '- 0,000'", () => {
    const row = (median: number) =>
      readModel("indice-luce", { indices: [{ median, unit: "€/kWh", date: "2026-10-30", basis: "spread", reference: "PUN" }] })?.rows[0].value;
    expect(row(-0.0001)).toBe("PUN + 0,000 €/kWh");
    expect(row(-0)).toBe("PUN + 0,000 €/kWh");
    expect(row(-0.0012)).toBe("PUN - 0,001 €/kWh");
  });
  it("reference fuori whitelist -> 'indice'; unita' tagliata a 10 caratteri", () => {
    const m = readModel("indice-gas", { indices: [
      { median: 0.1, unit: "€/Smc<script>alert(1)</script>", date: "2026-10-30", basis: "spread", reference: "<img src=x>" },
    ] });
    expect(m?.rows[0].value).toBe("indice + 0,100 €/Smc<scri");
  });
  it("data del modello = la piu' recente tra gli indici tenuti", () => {
    const m = readModel("indice-luce", { indices: [
      { median: 0.1, unit: "€/kWh", date: "2026-10-28", basis: "prezzo" },
      { median: 0.05, unit: "€/kWh", date: "2026-10-30", basis: "spread", reference: "PUN" },
    ] });
    expect(m?.date).toBe("30/10/2026");
  });
  it("garbage in: null, mai eccezioni ne' 'undefined'/'NaN'/'[object Object]'", () => {
    expect(readModel("pun", null)).toBeNull();
    expect(readModel("psv", "x")).toBeNull();
    expect(readModel("indice-luce", { indices: [null] })).toBeNull();
    expect(readModel("indice-luce", { indices: [{ median: "0.1", unit: "€/kWh", date: "2026-10-30" }] })).toBeNull();
    expect(readModel("indice-luce", { indices: [{ median: 0.1, unit: "€/kWh" }] })).toBeNull();
    expect(readModel("indice-luce", { indices: [{ median: 0.1, unit: 5, date: "2026-10-30" }] })).toBeNull();
    expect(readModel("indice-luce", { indices: [{ median: NaN, unit: "€/kWh", date: "2026-10-30" }] })).toBeNull();
    expect(readModel("pun", { daily_average: { date: "30/10", value_native: 1 } })).toBeNull();
    expect(readModel("psv", { value_native: 1, gas_day: "ieri" })).toBeNull();
    const pun = readModel("pun", { daily_average: { date: "2026-10-30", value_native: 274.04, unit_native: { x: 1 } } });
    expect(pun?.rows[0].value).toBe("274,04 €/MWh");
    const psv = readModel("psv", { value_native: 40.5, gas_day: "2026-10-31", unit_native: { x: 1 } });
    expect(psv?.rows[0].value).toBe("40,50 €/MWh");
    const mixed = readModel("indice-luce", { indices: [null, 7, { median: 0.12, unit: "€/kWh", date: "2026-10-30", basis: "prezzo" }] });
    expect(mixed?.rows).toEqual([{ label: "Prezzo fisso", value: "0,120 €/kWh" }]);
  });
});

describe("isRenderedVisible", () => {
  afterEach(() => vi.restoreAllMocks());
  function laidOut(html: string): HTMLAnchorElement {
    document.body.innerHTML = html;
    const a = document.querySelector("a") as HTMLAnchorElement;
    const rect = { left: 10, top: 10, right: 110, bottom: 30, width: 100, height: 20, x: 10, y: 10 } as DOMRect;
    a.getClientRects = () => [rect] as unknown as DOMRectList;
    a.getBoundingClientRect = () => rect;
    return a;
  }
  it("visibile se ha layout e stile normali", () => {
    expect(isRenderedVisible(laidOut('<div><a href="https://energyindex.it">EI</a></div>'))).toBe(true);
  });
  it("opacita' cumulata sotto 0,3: nascosto", () => {
    expect(isRenderedVisible(laidOut('<div style="opacity:0.5"><p style="opacity:0.5"><a href="#">EI</a></p></div>'))).toBe(false);
    expect(isRenderedVisible(laidOut('<div style="opacity:0.8"><a href="#">EI</a></div>'))).toBe(true);
  });
  it("visibility: hidden sull'ancora: nascosto; display:none su un antenato: nascosto", () => {
    expect(isRenderedVisible(laidOut('<a href="#" style="visibility:hidden">EI</a>'))).toBe(false);
    expect(isRenderedVisible(laidOut('<div style="display:none"><a href="#">EI</a></div>'))).toBe(false);
  });
  it("aria-hidden su un antenato: nascosto", () => {
    expect(isRenderedVisible(laidOut('<div aria-hidden="true"><a href="#">EI</a></div>'))).toBe(false);
  });
  it("fuori schermo: nascosto", () => {
    const a = laidOut('<a href="#">EI</a>');
    const off = { left: -9999, top: 10, right: -9899, bottom: 30, width: 100, height: 20, x: -9999, y: 10 } as DOMRect;
    a.getBoundingClientRect = () => off;
    expect(isRenderedVisible(a)).toBe(false);
  });
  it("usa checkVisibility quando il browser lo offre", () => {
    const a = laidOut('<a href="#">EI</a>');
    const check = vi.fn(() => false);
    (a as unknown as { checkVisibility: typeof check }).checkVisibility = check;
    expect(isRenderedVisible(a)).toBe(false);
    expect(check).toHaveBeenCalledWith({ opacityProperty: true, visibilityProperty: true });
  });
});
