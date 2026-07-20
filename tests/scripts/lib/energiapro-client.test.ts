/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { normalizeLogo } from "@/scripts/lib/energiapro-client";

describe("normalizeLogo", () => {
  it("prefisso relativo -> URL assoluto energiapro.biz", () => {
    expect(normalizeLogo("/logos/acea.png")).toBe("https://energiapro.biz/logos/acea.png");
  });
  it("URL gia' assoluto resta invariato", () => {
    expect(normalizeLogo("https://other.example.com/logo.png")).toBe("https://other.example.com/logo.png");
  });
  it("null -> null", () => {
    expect(normalizeLogo(null)).toBeNull();
  });
  it("path senza slash iniziale e' normalizzato", () => {
    expect(normalizeLogo("logos/x.png")).toBe("https://energiapro.biz/logos/x.png");
  });
});
