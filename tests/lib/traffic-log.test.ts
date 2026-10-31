/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { extractApiKey, redactQuery } from "@/lib/traffic/log";

describe("extractApiKey", () => {
  it("preferisce l'header Bearer alla querystring", () => {
    const h = new Headers({ authorization: "Bearer eidx_live_AAA" });
    expect(extractApiKey(h, new URLSearchParams("key=eidx_live_BBB"))).toBe("eidx_live_AAA");
  });
  it("accetta ?key= per compatibilita'", () => {
    expect(extractApiKey(new Headers(), new URLSearchParams("key=eidx_live_BBB"))).toBe("eidx_live_BBB");
  });
  it("null senza chiave", () => {
    expect(extractApiKey(new Headers(), new URLSearchParams())).toBeNull();
  });
});

describe("redactQuery", () => {
  it("maschera la chiave API", () => {
    expect(redactQuery(new URLSearchParams("key=eidx_live_abc&x=1"))).toBe("key=REDACTED&x=1");
  });
  it("toglie del tutto il token di verifica t", () => {
    expect(redactQuery(new URLSearchParams("t=Ab3dEfGh1jKlMnOpQrStUvWxYz012345&x=1"))).toBe("x=1");
    expect(redactQuery(new URLSearchParams("t=Ab3dEfGh1jKlMnOpQrStUvWxYz012345"))).toBeNull();
  });
});
