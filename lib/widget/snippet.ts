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
  const gme = def.gme ? `\n  <p class="eidx-src">Dati: Gestore dei Mercati Energetici S.p.A.</p>` : "";
  return `<div class="eidx-widget" data-eidx="${variant}" data-theme="${theme}">
  <a href="${def.page}?ref=widget">${def.label}</a>
  <p class="eidx-src">Fonte: <a href="https://energyindex.it">Energy Index</a></p>${gme}
</div>
<script src="${WIDGET_SCRIPT_URL}" async></script>`;
}
