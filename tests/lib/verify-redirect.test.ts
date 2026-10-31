/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { VERIFY_PATH, isVerifyToken, verifyTokenRedirect } from "@/lib/api-keys/verify-redirect";

const TOKEN = "Ab3dEfGh1jKlMnOpQrStUvWxYz012345";

describe("isVerifyToken", () => {
  it("accetta solo 32 caratteri base62", () => {
    expect(isVerifyToken(TOKEN)).toBe(true);
    expect(isVerifyToken(TOKEN.slice(1))).toBe(false);
    expect(isVerifyToken(`${TOKEN}x`)).toBe(false);
    expect(isVerifyToken("A".repeat(31) + "-")).toBe(false);
    expect(isVerifyToken("")).toBe(false);
  });
});

describe("verifyTokenRedirect", () => {
  it("token valido: redirect all'URL pulito con il token da mettere nel cookie", () => {
    expect(verifyTokenRedirect(VERIFY_PATH, new URLSearchParams({ t: TOKEN }))).toEqual({
      location: VERIFY_PATH,
      token: TOKEN,
    });
  });

  it("toglie anche gli altri parametri dall'URL", () => {
    const r = verifyTokenRedirect(VERIFY_PATH, new URLSearchParams({ t: TOKEN, utm_source: "email" }));
    expect(r?.location).toBe(VERIFY_PATH);
  });

  it("token malformato o vuoto: redirect senza token (il cookie va cancellato)", () => {
    expect(verifyTokenRedirect(VERIFY_PATH, new URLSearchParams({ t: "x<script>" }))).toEqual({
      location: VERIFY_PATH,
      token: null,
    });
    expect(verifyTokenRedirect(VERIFY_PATH, new URLSearchParams("t="))).toEqual({ location: VERIFY_PATH, token: null });
  });

  it("nessun redirect senza t o su altri percorsi", () => {
    expect(verifyTokenRedirect(VERIFY_PATH, new URLSearchParams())).toBeNull();
    expect(verifyTokenRedirect("/it/api", new URLSearchParams({ t: TOKEN }))).toBeNull();
    expect(verifyTokenRedirect(`${VERIFY_PATH}/altro`, new URLSearchParams({ t: TOKEN }))).toBeNull();
  });
});
