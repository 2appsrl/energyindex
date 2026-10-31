/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { generateApiKey, sha256Hex, keyDisplayPrefix, normalizeDomain, originAllowed, KEY_PREFIX } from "@/lib/api-keys/keys";

describe("generateApiKey", () => {
  it("formato eidx_live_ + 32 caratteri base62", () => {
    const k = generateApiKey();
    expect(k.startsWith(KEY_PREFIX)).toBe(true);
    expect(k.slice(KEY_PREFIX.length)).toMatch(/^[0-9A-Za-z]{32}$/);
  });
  it("chiavi diverse a ogni chiamata", () => {
    expect(generateApiKey()).not.toBe(generateApiKey());
  });
});

describe("sha256Hex", () => {
  it("hash noto", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("keyDisplayPrefix", () => {
  it("14 caratteri, come api_key_prefix in traffic_log", () => {
    expect(keyDisplayPrefix("eidx_live_AbCdEfGh")).toBe("eidx_live_AbCd");
  });
});

describe("normalizeDomain", () => {
  it.each([
    ["https://www.Esempio.it/pagina?x=1", "esempio.it"],
    ["esempio.it", "esempio.it"],
    ["blog.esempio.it", "blog.esempio.it"],
    ["  WWW.esempio.it/  ", "esempio.it"],
  ])("%s → %s", (input, out) => {
    expect(normalizeDomain(input)).toBe(out);
  });
  it.each(["", "localhost", "non un dominio", "http://", "192.168.1.1"])("rifiuta %s", (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });
});

describe("originAllowed", () => {
  it("dominio esatto, www e sottodomini", () => {
    expect(originAllowed("esempio.it", "esempio.it")).toBe(true);
    expect(originAllowed("www.esempio.it", "esempio.it")).toBe(true);
    expect(originAllowed("app.esempio.it", "esempio.it")).toBe(true);
  });
  it("localhost sempre ammesso per lo sviluppo", () => {
    expect(originAllowed("localhost:3000", "esempio.it")).toBe(true);
    expect(originAllowed("127.0.0.1:8080", "esempio.it")).toBe(true);
  });
  it("rifiuta altri domini e i suffissi falsi", () => {
    expect(originAllowed("altro.it", "esempio.it")).toBe(false);
    expect(originAllowed("fintoesempio.it", "esempio.it")).toBe(false);
    expect(originAllowed("esempio.it.attacker.com", "esempio.it")).toBe(false);
  });
});
