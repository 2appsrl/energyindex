/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { extractApiKey } from "@/lib/traffic/log";

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
