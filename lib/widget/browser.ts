/**
 * Entry di public/widget.js (IIFE generata da scripts/build-widget.ts).
 * Per ogni .eidx-widget:
 * 1) senza un link visibile a energyindex.it non chiama l'API e lo dice;
 * 2) altrimenti disegna i valori in uno Shadow DOM su un contenitore figlio,
 *    cosi' lo stile e' isolato e i link dello snippet restano nel DOM.
 *
 * Gira su pagine di terzi: niente globali (IIFE), idempotente se lo script e'
 * incluso due volte (flag data-eidx-ready), nessuna eccezione verso la pagina
 * ospite e nessun log in console.
 */
import { findAttribution, isRenderedVisible, readModel, WIDGET_VARIANTS, type WidgetVariant } from "./core";

/** Sostituita da esbuild (define): "https://energyindex.it", o WIDGET_BASE per le prove locali. */
declare const __EIDX_BASE__: string;
const BASE = __EIDX_BASE__;
const FETCH_TIMEOUT_MS = 8000;

const CSS = `:host{all:initial;display:block;font:14px/1.4 system-ui,-apple-system,sans-serif}
.box{border:1px solid var(--b);border-radius:12px;padding:12px 14px;background:var(--bg);color:var(--fg)}
.t{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin:0 0 6px}
.r{display:flex;justify-content:space-between;gap:12px;padding:3px 0}.v{font-weight:800;font-variant-numeric:tabular-nums}
.e{font-size:12px;opacity:.8;margin:6px 0 0}`;
const THEMES = { light: "--bg:#fff;--fg:#0a3d2e;--b:#d6e4dd", dark: "--bg:#0b1512;--fg:#e8f5ee;--b:#1f3a30" };

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c]);

/** src=widget per primo: il server riconosce il traffico del widget in traffic_log.query. */
function apiUrl(endpoint: string): string {
  const [path, query] = endpoint.split("?");
  return `${BASE}${path}?src=widget${query ? `&${query}` : ""}`;
}

async function mount(root: HTMLElement) {
  if (root.dataset.eidxReady) return;
  root.dataset.eidxReady = "1";
  const variant = root.dataset.eidx as WidgetVariant;
  const def = Object.prototype.hasOwnProperty.call(WIDGET_VARIANTS, variant) ? WIDGET_VARIANTS[variant] : null;
  if (!def) return;

  // Elemento custom (non definito): i selettori generici della pagina come
  // ".eidx-widget div" non lo colpiscono; display:block arriva da :host.
  const host = document.createElement("eidx-box");
  root.insertBefore(host, root.firstChild);
  const shadow = host.attachShadow({ mode: "open" });
  const theme = root.dataset.theme === "dark" ? THEMES.dark : THEMES.light;
  const paint = (inner: string) => {
    shadow.innerHTML = `<style>${CSS}:host{${theme}}</style><div class="box">${inner}</div>`;
  };

  if (!findAttribution(root, isRenderedVisible)) {
    paint(`<p class="e">Widget disattivato: manca il link di attribuzione a Energy Index.</p>`);
    return;
  }
  // Timeout di 8 s su richiesta e lettura del body: poi "non disponibile".
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl(def.endpoint), { signal: ctrl.signal });
    const model = res.ok ? readModel(variant, await res.json()) : null;
    if (!model) throw new Error("no data");
    const rows = model.rows
      .map((r) => `<div class="r"><span>${esc(r.label)}</span><span class="v">${esc(r.value)}</span></div>`)
      .join("");
    const date = model.date ? `<p class="e">Dato del ${esc(model.date)}</p>` : "";
    paint(`<p class="t">${esc(model.title)}</p>${rows}${date}`);
  } catch {
    paint(`<p class="e">Dato momentaneamente non disponibile.</p>`);
  } finally {
    clearTimeout(timer);
  }
}

function init() {
  document.querySelectorAll<HTMLElement>(".eidx-widget").forEach((el) => {
    mount(el).catch(() => {});
  });
}

// Dopo "load" (+ un frame): la verifica di visibilita' dell'attribuzione deve
// vedere i fogli di stile della pagina applicati, non il layout senza stili.
try {
  const start = () => requestAnimationFrame(() => {
    try { init(); } catch { /* mai eccezioni verso la pagina ospite */ }
  });
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
} catch { /* idem */ }
