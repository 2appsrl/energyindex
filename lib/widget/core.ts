/**
 * Logica pura del widget embeddabile (nessun accesso a window globale se
 * non tramite gli argomenti): testabile con jsdom e inclusa nel bundle
 * public/widget.js.
 */

export type WidgetVariant = "indice-luce" | "indice-gas" | "pun" | "psv";

export const WIDGET_VARIANTS: Record<WidgetVariant, { endpoint: string; gme: boolean; page: string; label: string }> = {
  "indice-luce": { endpoint: "/api/v1/energy-index?commodity=luce", gme: false, page: "https://energyindex.it/it/mercato-libero", label: "Energy Index · Luce" },
  "indice-gas": { endpoint: "/api/v1/energy-index?commodity=gas", gme: false, page: "https://energyindex.it/it/mercato-libero", label: "Energy Index · Gas" },
  pun: { endpoint: "/api/v1/pun/today", gme: true, page: "https://energyindex.it/it/indice/pun", label: "PUN di oggi" },
  psv: { endpoint: "/api/v1/psv/today", gme: true, page: "https://energyindex.it/it/indice/psv", label: "PSV giorno gas" },
};

const HOST_RE = /^https?:\/\/(www\.)?energyindex\.(it|pro)(\/|$)/i;

/** Link di attribuzione valido e visibile dentro il widget, o null. */
export function findAttribution(root: HTMLElement, isVisible: (a: HTMLAnchorElement) => boolean): HTMLAnchorElement | null {
  for (const a of Array.from(root.querySelectorAll("a"))) {
    if (HOST_RE.test(a.href) && (a.textContent ?? "").trim().length > 0 && isVisible(a)) return a;
  }
  return null;
}

/** Visibilita' reale nel browser (in jsdom non c'e' layout: nei test si inietta). */
export function isRenderedVisible(a: HTMLAnchorElement): boolean {
  if (a.getClientRects().length === 0) return false;
  for (let el: HTMLElement | null = a; el; el = el.parentElement) {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.3) return false;
  }
  const r = a.getBoundingClientRect();
  return r.width > 1 && r.height > 1;
}

export function formatEuro(v: number, unit: string, decimals: number): string {
  return `${v.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}`;
}

const itDate = (iso: string) => iso.split("-").reverse().join("/");

export interface WidgetModel {
  title: string;
  /** Data del dato (gg/mm/aaaa), mostrata nel widget: gli indici offerte possono essere di qualche giorno fa. */
  date?: string;
  rows: { label: string; value: string }[];
}

type Json = Record<string, unknown>;

export function readModel(variant: WidgetVariant, body: Json): WidgetModel | null {
  if (variant === "pun") {
    const d = body.daily_average as { date?: string; value_native?: number; unit_native?: string } | undefined;
    if (!d?.date || typeof d.value_native !== "number") return null;
    return { title: "PUN medio", rows: [{ label: itDate(d.date), value: formatEuro(d.value_native, d.unit_native ?? "€/MWh", 2) }] };
  }
  if (variant === "psv") {
    const v = body.value_native, day = body.gas_day;
    if (typeof v !== "number" || typeof day !== "string") return null;
    return { title: "PSV giorno gas", rows: [{ label: itDate(day), value: formatEuro(v, String(body.unit_native ?? "€/MWh"), 2) }] };
  }
  // Per le variabili le statistiche sono lo spread sull'indice (PUN/PSV), non un prezzo.
  const indices = body.indices as { slug: string; median: number; unit: string; date: string; basis?: string; reference?: string }[] | undefined;
  if (!Array.isArray(indices) || indices.length === 0) return null;
  const rows = [...indices]
    .sort((a, b) => Number(b.basis !== "spread") - Number(a.basis !== "spread"))
    .map((i) =>
      i.basis === "spread"
        ? { label: "Prezzo variabile", value: `${i.reference ?? "indice"} ${i.median < 0 ? "-" : "+"} ${formatEuro(Math.abs(i.median), i.unit, 3)}` }
        : { label: "Prezzo fisso", value: formatEuro(i.median, i.unit, 3) },
    );
  return { title: variant === "indice-luce" ? "Offerte luce · mediana" : "Offerte gas · mediana", date: itDate(indices[0].date), rows };
}
