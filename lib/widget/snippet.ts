import { WIDGET_VARIANTS, type WidgetVariant } from "./core";

export type WidgetTheme = "light" | "dark";

/** Ordine del configuratore: prima i nostri indici, poi i dati GME. */
export const WIDGET_VARIANT_ORDER: WidgetVariant[] = ["indice-luce", "indice-gas", "pun", "psv"];

export const WIDGET_SCRIPT_URL = "https://energyindex.it/widget.js";

/**
 * Snippet da incollare. I link stanno nell'HTML statico: Google li vede e la
 * verifica settimanale li trova anche se lo script non gira. Solo il link
 * alla pagina indice porta ?ref=widget; il link "Fonte" resta pulito.
 */
export function buildSnippet(variant: WidgetVariant, theme: WidgetTheme): string {
  const def = WIDGET_VARIANTS[variant];
  // Le condizioni GME chiedono "Fonte: Gestore dei Mercati Energetici S.p.A.":
  // stessa dicitura del campo attribution delle API PUN/PSV.
  const source = def.gme
    ? `Fonte: Gestore dei Mercati Energetici S.p.A. — via <a href="https://energyindex.it">Energy Index</a>`
    : `Fonte: <a href="https://energyindex.it">Energy Index</a>`;
  return `<div class="eidx-widget" data-eidx="${variant}" data-theme="${theme}">
  <a href="${def.page}?ref=widget">${def.label}</a>
  <p class="eidx-src">${source}</p>
</div>
<script src="${WIDGET_SCRIPT_URL}" async></script>`;
}
