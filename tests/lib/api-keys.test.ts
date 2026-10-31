/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { generateApiKey, sha256Hex, keyDisplayPrefix, normalizeDomain, originAllowed, hostMatchesDomain, isEidxKey, originHostFromHeader, KEY_PREFIX } from "@/lib/api-keys/keys";

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
  it.each(["github.io", "co.uk", "https://www.netlify.app/"])("rifiuta il suffisso condiviso %s", (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });
  it("accetta un sito ospitato su un suffisso condiviso", () => {
    expect(normalizeDomain("miosito.github.io")).toBe("miosito.github.io");
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

describe("hostMatchesDomain", () => {
  it("nessuna eccezione per localhost: vale solo il dominio", () => {
    expect(hostMatchesDomain("127.0.0.1", "esempio.it")).toBe(false);
    expect(hostMatchesDomain("localhost:3000", "esempio.it")).toBe(false);
  });
  it("accetta i sottodomini, anche con porta e maiuscole", () => {
    expect(hostMatchesDomain("sub.esempio.it", "esempio.it")).toBe(true);
    expect(hostMatchesDomain("Sub.Esempio.it:443", "esempio.it")).toBe(true);
  });
  it("rifiuta i suffissi falsi", () => {
    expect(hostMatchesDomain("fintoesempio.it", "esempio.it")).toBe(false);
  });
});

describe("isEidxKey", () => {
  it("riconosce solo le chiavi Energy Index", () => {
    expect(isEidxKey(generateApiKey())).toBe(true);
    expect(isEidxKey("eidx_live_FAKEFAKE")).toBe(true);
  });
  it("token Bearer di altri servizi: non sono chiavi (anonimo, niente 401)", () => {
    expect(isEidxKey("ghp_abcdef")).toBe(false);
    expect(isEidxKey("eyJhbGciOiJIUzI1NiJ9.x.y")).toBe(false);
    expect(isEidxKey("EIDX_LIVE_abc")).toBe(false);
    expect(isEidxKey("")).toBe(false);
  });
});

describe("originHostFromHeader", () => {
  it("senza header: null", () => {
    expect(originHostFromHeader(null)).toBeNull();
  });
  it("Origin valido: host[:porta]", () => {
    expect(originHostFromHeader("https://www.esempio.it")).toBe("www.esempio.it");
    expect(originHostFromHeader("http://localhost:3000")).toBe("localhost:3000");
  });
  it("Origin opaco o malformato: resta il valore grezzo, cosi' il vincolo di dominio non salta", () => {
    expect(originHostFromHeader("null")).toBe("null");
    expect(originHostFromHeader("file://")).toBe("file://");
    expect(originHostFromHeader("non un url")).toBe("non un url");
  });
});
