/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { classifySource, runSourceChecks } from "@/lib/api-keys/source-check";

describe("classifySource", () => {
  it("link vero alla fonte", () => {
    expect(classifySource('<a class="market-attribution" href="https://energyindex.it" rel="noopener">Fonte: Energy Index</a>')).toBe("link");
  });

  it("link con testo diverso verso una nostra pagina", () => {
    expect(classifySource('<a href="https://energyindex.it/it/indice/pun">fonte e serie PUN</a>')).toBe("link");
  });

  it("link dentro un riquadro incorporato (srcdoc con entita')", () => {
    expect(classifySource('<iframe srcdoc="&lt;a href=&quot;https://energyindex.it&quot;&gt;Fonte&lt;/a&gt;"></iframe>')).toBe("link");
  });

  it("nominata nel testo ma senza link", () => {
    expect(classifySource("<p>Fonte: Energy Index</p>")).toBe("testo");
  });

  it("caso Casadoc: la frase e' solo nello script che la mette nel tooltip", () => {
    const html = `<iframe srcdoc="&lt;script&gt;fetch('https://energyindex.it/api/v1/pun/today');row.title='Fonte: Energy Index'&lt;/script&gt;&lt;td&gt;PUN&lt;/td&gt;"></iframe>`;
    expect(classifySource(html)).toBe("assente");
  });

  it("un attributo title non e' testo visibile", () => {
    expect(classifySource('<td title="Fonte: Energy Index">PUN</td>')).toBe("assente");
  });

  it("niente in un commento HTML", () => {
    expect(classifySource('<!-- <a href="https://energyindex.it">Fonte: Energy Index</a> -->')).toBe("assente");
  });

  it("domini simili non contano", () => {
    expect(classifySource('<a href="https://energyindex.it.evil.com">x</a>')).toBe("assente");
  });
});

describe("runSourceChecks", () => {
  const NOW = new Date("2026-11-09T07:00:00Z");

  it("scarica la home di ogni sito e salva l'esito", async () => {
    const fetchHtml = vi.fn(async (url: string) =>
      url === "https://a.it/" ? '<a href="https://energyindex.it">Fonte</a>' : "<p>niente</p>",
    );
    const save = vi.fn(async () => {});
    const r = await runSourceChecks(["a.it", "b.it"], { fetchHtml, save, now: () => NOW });

    expect(fetchHtml).toHaveBeenCalledWith("https://a.it/");
    expect(save).toHaveBeenCalledWith({ site: "a.it", status: "link", checked_at: NOW.toISOString() });
    expect(save).toHaveBeenCalledWith({ site: "b.it", status: "assente", checked_at: NOW.toISOString() });
    expect(r).toEqual({ checked: 2, link: 1, testo: 0, assente: 1, errore: 0, saveErrors: 0 });
  });

  it("una pagina che non si scarica e' errore, non assente", async () => {
    const save = vi.fn(async () => {});
    const r = await runSourceChecks(["a.it"], { fetchHtml: async () => null, save, now: () => NOW });
    expect(save).toHaveBeenCalledWith({ site: "a.it", status: "errore", checked_at: NOW.toISOString() });
    expect(r.errore).toBe(1);
  });

  it("un errore di salvataggio non ferma gli altri siti", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("db")).mockResolvedValue(undefined);
    const r = await runSourceChecks(["a.it", "b.it"], { fetchHtml: async () => "<p></p>", save, now: () => NOW });
    expect(save).toHaveBeenCalledTimes(2);
    expect(r.saveErrors).toBe(1);
  });
});
