/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { fetchHasLink, hasEnergyIndexLink, isCheckableUrl, nextLinkState } from "@/lib/api-keys/link-check";

describe("hasEnergyIndexLink", () => {
  it.each([
    ['<p>Fonte: <a href="https://energyindex.it">Energy Index</a></p>'],
    ["<a class='x' href='https://www.energyindex.it/it/indice/pun' rel='nofollow'>EI</a>"],
    ['<A HREF="//energyindex.it/">Energy Index</A>'],
    ['<a href=https://energyindex.pro>x</a>'],
  ])("trova il link in %s", (html) => {
    expect(hasEnergyIndexLink(html)).toBe(true);
  });

  it.each([
    ["<p>Fonte: Energy Index</p>"],
    ['<!-- <a href="https://energyindex.it">x</a> -->'],
    ['<a href="https://energyindex.it.evil.com">x</a>'],
    ['<a href="https://notenergyindex.it">x</a>'],
    ['<link rel="preconnect" href="https://energyindex.it">'],
    ['<a data-href="https://energyindex.it">x</a>'],
  ])("non lo trova in %s", (html) => {
    expect(hasEnergyIndexLink(html)).toBe(false);
  });
});

describe("nextLinkState", () => {
  it("link presente: azzera i fallimenti e riattiva una chiave declassata", () => {
    expect(nextLinkState({ status: "downgraded", link_failures: 3 }, true)).toEqual({ status: "active", link_failures: 0, notify: "restored" });
    expect(nextLinkState({ status: "active", link_failures: 1 }, true)).toEqual({ status: "active", link_failures: 0, notify: null });
  });
  it("primo fallimento: solo conteggio", () => {
    expect(nextLinkState({ status: "active", link_failures: 0 }, false)).toEqual({ status: "active", link_failures: 1, notify: null });
  });
  it("secondo fallimento consecutivo: declassa e avvisa una volta", () => {
    expect(nextLinkState({ status: "active", link_failures: 1 }, false)).toEqual({ status: "downgraded", link_failures: 2, notify: "downgraded" });
    expect(nextLinkState({ status: "downgraded", link_failures: 2 }, false)).toEqual({ status: "downgraded", link_failures: 3, notify: null });
  });
  it.each(["revoked", "pending"] as const)("chiave %s: stato invariato, nessun avviso", (status) => {
    expect(nextLinkState({ status, link_failures: 1 }, true)).toEqual({ status, link_failures: 1, notify: null });
    expect(nextLinkState({ status, link_failures: 1 }, false)).toEqual({ status, link_failures: 1, notify: null });
  });
});

const PAGE_OK = '<p>Fonte: <a href="https://energyindex.it">Energy Index</a></p>';

function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

/** fetch finto: risponde in base all'URL, registra le chiamate. */
function fakeFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    void init;
    const route = routes[url];
    if (!route) throw new Error(`fetch inatteso: ${url}`);
    return route();
  });
}

describe("isCheckableUrl", () => {
  it.each([
    "https://esempio.it/prezzi",
    "http://blog.esempio.it/x?y=1",
    "https://esempio.it:443/x",
  ])("accetta %s", (u) => {
    expect(isCheckableUrl(new URL(u))).toBe(true);
  });

  it.each([
    "ftp://esempio.it/x",
    "file:///etc/passwd",
    "http://127.0.0.1/x",
    "http://[::1]/x",
    "http://localhost:3000/x",
    "http://intranet/x",
    "http://10.0.0.1/x",
    "https://esempio.it:6379/x",
    "https://utente:segreto@esempio.it/x",
  ])("rifiuta %s", (u) => {
    expect(isCheckableUrl(new URL(u))).toBe(false);
  });
});

describe("fetchHasLink", () => {
  it("200 con il link: true, senza seguire redirect automatici", async () => {
    const f = fakeFetch({ "https://esempio.it/prezzi": () => new Response(PAGE_OK, { status: 200 }) });
    expect(await fetchHasLink("https://esempio.it/prezzi", f)).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("200 senza link o errore HTTP: false", async () => {
    const f = fakeFetch({
      "https://esempio.it/a": () => new Response("<p>niente</p>", { status: 200 }),
      "https://esempio.it/b": () => new Response(PAGE_OK, { status: 500 }),
    });
    expect(await fetchHasLink("https://esempio.it/a", f)).toBe(false);
    expect(await fetchHasLink("https://esempio.it/b", f)).toBe(false);
  });

  it("URL iniziale non ammesso: false senza fare richieste", async () => {
    const f = fakeFetch({});
    expect(await fetchHasLink("http://127.0.0.1/x", f)).toBe(false);
    expect(await fetchHasLink("non un url", f)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it("redirect verso loopback: false senza scaricarlo", async () => {
    const f = fakeFetch({ "https://esempio.it/x": () => redirect("http://127.0.0.1/admin") });
    expect(await fetchHasLink("https://esempio.it/x", f)).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("redirect relativo e fino a 3 salti: segue e trova il link", async () => {
    const f = fakeFetch({
      "https://esempio.it/1": () => redirect("/2", 301),
      "https://esempio.it/2": () => redirect("https://www.esempio.it/3", 307),
      "https://www.esempio.it/3": () => redirect("https://esempio.it/fine", 308),
      "https://esempio.it/fine": () => new Response(PAGE_OK, { status: 200 }),
    });
    expect(await fetchHasLink("https://esempio.it/1", f)).toBe(true);
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("4 redirect: false, il quinto URL non viene scaricato", async () => {
    const f = fakeFetch({
      "https://esempio.it/1": () => redirect("/2"),
      "https://esempio.it/2": () => redirect("/3"),
      "https://esempio.it/3": () => redirect("/4"),
      "https://esempio.it/4": () => redirect("/5"),
      "https://esempio.it/5": () => new Response(PAGE_OK, { status: 200 }),
    });
    expect(await fetchHasLink("https://esempio.it/1", f)).toBe(false);
    expect(f).toHaveBeenCalledTimes(4);
  });

  it("redirect senza Location o fetch che lancia: false", async () => {
    const f = fakeFetch({
      "https://esempio.it/a": () => new Response(null, { status: 302 }),
      "https://esempio.it/b": () => {
        throw new Error("rete");
      },
    });
    expect(await fetchHasLink("https://esempio.it/a", f)).toBe(false);
    expect(await fetchHasLink("https://esempio.it/b", f)).toBe(false);
  });

  it("legge al massimo ~2 MB: un link oltre il limite non conta", async () => {
    const big = "x".repeat(2_100_000) + PAGE_OK;
    const f = fakeFetch({ "https://esempio.it/big": () => new Response(big, { status: 200 }) });
    expect(await fetchHasLink("https://esempio.it/big", f)).toBe(false);
  });
});
