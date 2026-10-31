/**
 * Logica pura del widget embeddabile, inclusa nel bundle public/widget.js.
 * Nessun effetto all'import: le API del browser (getComputedStyle, scroll,
 * layout) si leggono solo dentro le funzioni, al momento della chiamata,
 * cosi' il modulo si testa con jsdom.
 *
 * Il controllo di visibilita' dell'attribuzione e' solo un deterrente lato
 * client (chi controlla la pagina puo' aggirarlo): l'applicazione vera e'
 * la verifica settimanale lato server dei link di attribuzione.
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

/**
 * Visibilita' reale nel browser (in jsdom non c'e' layout: nei test si inietta
 * o si simula). Opacita' cumulata sugli antenati, visibility sull'ancora
 * (un figlio puo' tornare visibile sotto un padre hidden), niente aria-hidden,
 * niente posizionamento fuori schermo.
 */
export function isRenderedVisible(a: HTMLAnchorElement): boolean {
  if (a.getClientRects().length === 0) return false;
  if (a.closest('[aria-hidden="true"]')) return false;
  const check = (a as { checkVisibility?: (o: { opacityProperty: boolean; visibilityProperty: boolean }) => boolean }).checkVisibility;
  if (typeof check === "function" && !check.call(a, { opacityProperty: true, visibilityProperty: true })) return false;
  if (getComputedStyle(a).visibility === "hidden") return false;
  let opacity = 1;
  for (let el: Element | null = a; el; el = el.parentElement) {
    const s = getComputedStyle(el);
    if (s.display === "none") return false;
    const o = parseFloat(s.opacity);
    if (!isNaN(o)) opacity *= o;
    if (opacity < 0.3) return false;
  }
  const r = a.getBoundingClientRect();
  if (r.width <= 1 || r.height <= 1) return false;
  return !(r.right + window.scrollX <= 0 || r.bottom + window.scrollY <= 0);
}

export function formatEuro(v: number, unit: string, decimals: number): string {
  return `${v.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}`;
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isoDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const unitOf = (v: unknown, fallback: string): string => (str(v) ? v.slice(0, 10) : fallback);
const itDate = (iso: string) => iso.split("-").reverse().join("/");

/** "+ 0,055 €/kWh" / "- 0,012 €/Smc": il segno segue il valore mostrato, mai "- 0,000". */
function signed(v: number, unit: string, decimals: number): string {
  const abs = formatEuro(Math.abs(v), unit, decimals);
  return `${v < 0 && /[1-9]/.test(abs.split(" ")[0]) ? "-" : "+"} ${abs}`;
}

export interface WidgetModel {
  title: string;
  /** Data del dato (gg/mm/aaaa), mostrata nel widget: gli indici offerte possono essere di qualche giorno fa. */
  date?: string;
  rows: { label: string; value: string }[];
}

interface IndexItem { median: number; unit: string; date: string; basis?: unknown; reference?: unknown }

export function readModel(variant: WidgetVariant, body: unknown): WidgetModel | null {
  if (!isObj(body)) return null;
  if (variant === "pun") {
    const d = body.daily_average;
    if (!isObj(d) || !isoDay(d.date) || !num(d.value_native)) return null;
    return { title: "PUN medio", rows: [{ label: itDate(d.date), value: formatEuro(d.value_native, unitOf(d.unit_native, "€/MWh"), 2) }] };
  }
  if (variant === "psv") {
    const v = body.value_native, day = body.gas_day;
    if (!num(v) || !isoDay(day)) return null;
    return { title: "PSV giorno gas", rows: [{ label: itDate(day), value: formatEuro(v, unitOf(body.unit_native, "€/MWh"), 2) }] };
  }
  // Per le variabili le statistiche sono lo spread sull'indice (PUN/PSV), non un prezzo.
  if (!Array.isArray(body.indices)) return null;
  const items = body.indices.filter(
    (i): i is IndexItem => isObj(i) && num(i.median) && str(i.unit) && isoDay(i.date),
  );
  if (items.length === 0) return null;
  const rows = [...items]
    .sort((a, b) => Number(b.basis !== "spread") - Number(a.basis !== "spread"))
    .map((i) => {
      const unit = unitOf(i.unit, "");
      if (i.basis !== "spread") return { label: "Prezzo fisso", value: formatEuro(i.median, unit, 3) };
      const ref = i.reference === "PUN" || i.reference === "PSV" ? i.reference : "indice";
      return { label: "Prezzo variabile", value: `${ref} ${signed(i.median, unit, 3)}` };
    });
  const latest = items.reduce((m, i) => (i.date > m ? i.date : m), items[0].date);
  return { title: variant === "indice-luce" ? "Offerte luce · mediana" : "Offerte gas · mediana", date: itDate(latest), rows };
}
