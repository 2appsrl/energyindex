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

  it("varianti GME: riga di fonte GME obbligatoria", () => {
    expect(buildSnippet("pun", "dark")).toContain("Dati: Gestore dei Mercati Energetici S.p.A.");
    expect(buildSnippet("psv", "light")).toContain("Dati: Gestore dei Mercati Energetici S.p.A.");
    expect(buildSnippet("indice-gas", "dark")).not.toContain("Gestore dei Mercati");
    expect(buildSnippet("indice-luce", "light")).not.toContain("Gestore dei Mercati");
  });

  it("?ref=widget solo sul link della pagina indice", () => {
    const s = buildSnippet("pun", "light");
    expect(s).toContain(`href="${WIDGET_VARIANTS.pun.page}?ref=widget"`);
    expect(s).toContain('href="https://energyindex.it">Energy Index</a>');
    expect(s.match(/\?ref=widget/g)).toHaveLength(1);
  });
});
