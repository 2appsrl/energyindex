/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { decideAccess, type KeyRecord } from "@/lib/api-keys/gate";

const active: KeyRecord = { prefix: "eidx_live_ab12", status: "active", domain: "esempio.it", plan: "developer" };
const base = { hasKey: false, key: null, lookupFailed: false, originHost: null, throttledKey: false, throttledIp: false };

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

  it("una chiave attiva non paga il throttle per IP condiviso", () => {
    expect(decideAccess({ ...base, hasKey: true, key: active, throttledIp: true }).ok).toBe(true);
  });
});
