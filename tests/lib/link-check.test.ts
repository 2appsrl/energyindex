/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { hasEnergyIndexLink, nextLinkState } from "@/lib/api-keys/link-check";

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
