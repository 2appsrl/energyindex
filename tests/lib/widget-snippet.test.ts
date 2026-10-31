/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { buildSnippet } from "@/lib/widget/snippet";
import { hasEnergyIndexLink } from "@/lib/api-keys/link-check";
import { WIDGET_VARIANTS, type WidgetVariant } from "@/lib/widget/core";

const VARIANTS = Object.keys(WIDGET_VARIANTS) as WidgetVariant[];

describe("buildSnippet", () => {
  it("contiene il link di attribuzione nell'HTML statico", () => {
    const s = buildSnippet("indice-luce", "light");
    expect(hasEnergyIndexLink(s)).toBe(true);
    expect(s).toContain('data-eidx="indice-luce"');
    expect(s).toContain('data-theme="light"');
    expect(s).toContain('<script src="https://energyindex.it/widget.js" async></script>');
  });

  it("ogni variante e tema supera la verifica del link", () => {
    for (const v of VARIANTS) {
      for (const t of ["light", "dark"] as const) {
        expect(hasEnergyIndexLink(buildSnippet(v, t))).toBe(true);
      }
    }
  });

  it("anchor di marca, mai keyword", () => {
    expect(buildSnippet("pun", "light")).toMatch(/>Energy Index<\/a>/);
  });

  it("varianti GME: una sola riga 'Fonte: GME — via Energy Index', come il campo attribution", () => {
    const line =
      '<p class="eidx-src">Fonte: Gestore dei Mercati Energetici S.p.A. — via <a href="https://energyindex.it">Energy Index</a></p>';
    for (const v of ["pun", "psv"] as const) {
      const s = buildSnippet(v, "dark");
      expect(s).toContain(line);
      expect(s).not.toContain("Dati:");
      expect(s.match(/class="eidx-src"/g)).toHaveLength(1);
    }
  });

  it("indici Energy Index: fonte Energy Index, senza GME", () => {
    for (const v of ["indice-luce", "indice-gas"] as const) {
      const s = buildSnippet(v, "light");
      expect(s).toContain('<p class="eidx-src">Fonte: <a href="https://energyindex.it">Energy Index</a></p>');
      expect(s).not.toContain("Gestore dei Mercati");
    }
  });

  it("?ref=widget solo sul link della pagina indice", () => {
    const s = buildSnippet("pun", "light");
    expect(s).toContain(`href="${WIDGET_VARIANTS.pun.page}?ref=widget"`);
    expect(s).toContain('href="https://energyindex.it">Energy Index</a>');
    expect(s.match(/\?ref=widget/g)).toHaveLength(1);
  });
});
