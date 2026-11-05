/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { decideAccess, isGmeDataPath, type KeyRecord } from "@/lib/api-keys/gate";

const active: KeyRecord = { prefix: "eidx_live_ab12", status: "active", domain: "esempio.it", plan: "developer" };
const base = {
  hasKey: false,
  key: null,
  lookupFailed: false,
  originHost: null,
  throttledKey: false,
  throttledIp: false,
  enforceThrottle: true,
};

describe("decideAccess", () => {
  it("anonimo: passa con il limite Open", () => {
    const r = decideAccess(base);
    expect(r.ok).toBe(true);
    expect(r.headers["X-RateLimit-Limit"]).toBe("60");
  });

  it("chiave sconosciuta o revocata: 401", () => {
    expect(decideAccess({ ...base, hasKey: true }).ok).toBe(false);
    const r = decideAccess({ ...base, hasKey: true, key: { ...active, status: "revoked" } });
    expect(r.ok === false && r.status).toBe(401);
  });

  it("DB irraggiungibile: fail-open come anonimo", () => {
    expect(decideAccess({ ...base, hasKey: true, lookupFailed: true }).ok).toBe(true);
  });

  it("chiave attiva dal suo dominio: passa con il limite del piano", () => {
    const r = decideAccess({ ...base, hasKey: true, key: active, originHost: "www.esempio.it" });
    expect(r.ok).toBe(true);
    expect(r.headers["X-RateLimit-Limit"]).toBe("120");
    expect(r.headers["X-EIDX-Key-Status"]).toBe("active");
  });

  it("chiave usata da un altro sito: 403 origin_not_allowed", () => {
    const r = decideAccess({ ...base, hasKey: true, key: active, originHost: "altro.it" });
    expect(r.ok === false && r.status).toBe(403);
    expect(r.ok === false && r.body.error).toBe("origin_not_allowed");
  });

  it("chiamata server senza Origin: passa", () => {
    expect(decideAccess({ ...base, hasKey: true, key: active }).ok).toBe(true);
  });

  it("chiave declassata: limiti Open e avviso nell'header", () => {
    const r = decideAccess({ ...base, hasKey: true, key: { ...active, status: "downgraded" } });
    expect(r.ok).toBe(true);
    expect(r.headers["X-RateLimit-Limit"]).toBe("60");
    expect(r.headers["X-EIDX-Notice"]).toBe("attribution-missing");
  });

  it("oltre quota: 429 con Retry-After", () => {
    const r1 = decideAccess({ ...base, hasKey: true, key: active, throttledKey: true });
    expect(r1.ok === false && r1.status).toBe(429);
    expect(r1.headers["Retry-After"]).toBe("900");
    const r2 = decideAccess({ ...base, throttledIp: true });
    expect(r2.ok === false && r2.status).toBe(429);
  });

  it("chiave pending (email non verificata): 401", () => {
    const r = decideAccess({ ...base, hasKey: true, key: { ...active, status: "pending" } });
    expect(r.ok === false && r.status).toBe(401);
    expect(r.ok === false && r.body.error).toBe("invalid_key");
    expect(r.ok === false && r.body.message).toBe("Chiave non ancora attivata: conferma il link ricevuto via email.");
  });

  it("chiave attiva con Origin opaco (\"null\", iframe sandbox o file://): 403", () => {
    const r = decideAccess({ ...base, hasKey: true, key: active, originHost: "null" });
    expect(r.ok === false && r.status).toBe(403);
  });

  it("chiave declassata da un altro sito: 403", () => {
    const r = decideAccess({ ...base, hasKey: true, key: { ...active, status: "downgraded" }, originHost: "altro.it" });
    expect(r.ok === false && r.status).toBe(403);
  });

  it("DB irraggiungibile ma IP in throttle: 429 (fail-open non toglie il limite)", () => {
    const r = decideAccess({ ...base, hasKey: true, lookupFailed: true, throttledIp: true });
    expect(r.ok === false && r.status).toBe(429);
  });

  it("una chiave attiva non paga il throttle per IP condiviso", () => {
    expect(decideAccess({ ...base, hasKey: true, key: active, throttledIp: true }).ok).toBe(true);
  });

  describe("throttle in sola osservazione (enforceThrottle false)", () => {
    const observe = { ...base, enforceThrottle: false };

    it("oltre quota per chiave o per IP: nessun 429, passa con l'header di osservazione", () => {
      const r1 = decideAccess({ ...observe, hasKey: true, key: active, throttledKey: true });
      expect(r1.ok).toBe(true);
      expect(r1.headers["X-EIDX-Throttle"]).toBe("observe");
      expect(r1.headers["X-RateLimit-Limit"]).toBe("120");
      expect(r1.headers["Retry-After"]).toBeUndefined();
      const r2 = decideAccess({ ...observe, throttledIp: true });
      expect(r2.ok).toBe(true);
      expect(r2.headers["X-EIDX-Throttle"]).toBe("observe");
    });

    it("sotto quota: nessun header di osservazione", () => {
      expect(decideAccess(observe).headers["X-EIDX-Throttle"]).toBeUndefined();
    });

    it("chiave e Origin restano applicati: 401 e 403 anche in osservazione", () => {
      const r1 = decideAccess({ ...observe, hasKey: true, throttledIp: true });
      expect(r1.ok === false && r1.status).toBe(401);
      const r2 = decideAccess({ ...observe, hasKey: true, key: active, originHost: "altro.it", throttledKey: true });
      expect(r2.ok === false && r2.status).toBe(403);
    });

    it("con enforceThrottle true l'header di osservazione non compare", () => {
      const r = decideAccess({ ...base, throttledIp: true });
      expect(r.ok === false && r.status).toBe(429);
      expect(r.headers["X-EIDX-Throttle"]).toBeUndefined();
    });
  });
});

describe("dati GME: nessun piano a pagamento concede piu' richieste", () => {
  const paid: KeyRecord = { prefix: "eidx_live_paid", status: "active", domain: "esempio.it", plan: "pro" };

  it.each([
    ["/api/v1/pun/today", true],
    ["/api/v1/psv/today", true],
    ["/api/v1/pun/hourly", true],
    ["/api/v1/pun/zones", true],
    ["/api/v1/today", true],
    ["/api/v1/prices/pun/series", true],
    ["/api/v1/prices/psv/series", true],
    ["/api/v1/prices/ttf/series", false],
    ["/api/v1/energy-index", false],
    ["/api/v1/forecast/pun", false],
    ["/api/v1/punto", false],
    ["/api/v1", false],
  ])("%s e' dato GME: %s", (path, expected) => {
    expect(isGmeDataPath(path)).toBe(expected);
  });

  it("su un dato GME il piano Pro ha lo stesso limite del Developer", () => {
    const r = decideAccess({ ...base, hasKey: true, key: paid, gmeData: true });
    expect(r.headers["X-RateLimit-Limit"]).toBe("120");
  });

  it("sugli altri servizi il piano Pro mantiene il suo limite", () => {
    const r = decideAccess({ ...base, hasKey: true, key: paid, gmeData: false });
    expect(r.headers["X-RateLimit-Limit"]).toBe("1200");
  });

  it("il Developer e l'anonimo non cambiano sui dati GME", () => {
    expect(decideAccess({ ...base, hasKey: true, key: active, gmeData: true }).headers["X-RateLimit-Limit"]).toBe("120");
    expect(decideAccess({ ...base, gmeData: true }).headers["X-RateLimit-Limit"]).toBe("60");
  });

  it("oltre la quota GME la chiave a pagamento e' bloccata solo sui dati GME", () => {
    const over = { ...base, hasKey: true, key: paid, throttledGmeKey: true };
    expect(decideAccess({ ...over, gmeData: true }).ok).toBe(false);
    expect(decideAccess({ ...over, gmeData: false }).ok).toBe(true);
  });
});
