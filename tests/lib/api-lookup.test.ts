/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLookup } from "@/lib/api-keys/lookup";

const env = { url: "https://db.test", serviceKey: "svc" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createLookup", () => {
  let now = 0;
  beforeEach(() => { now = 1_000_000; });

  it("trova la chiave per hash e la tiene in cache 60 s", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse([{ prefix: "eidx_live_ab12", status: "active", domain: "esempio.it", plan: "developer" }]));
    const lk = createLookup({ ...env, fetchFn, now: () => now });
    expect((await lk.key("h1")).key?.domain).toBe("esempio.it");
    await lk.key("h1");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    now += 61_000;
    await lk.key("h1");
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(String(fetchFn.mock.calls[0][0])).toContain("key_hash=eq.h1");
  });

  it("chiave inesistente: key null, nessun errore", async () => {
    const lk = createLookup({ ...env, fetchFn: async () => jsonResponse([]), now: () => now });
    expect(await lk.key("nope")).toEqual({ key: null, failed: false });
  });

  it("errore DB: failed true, nessuna cache", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ message: "boom" }, 500));
    const lk = createLookup({ ...env, fetchFn, now: () => now });
    expect((await lk.key("h1")).failed).toBe(true);
    now += 16_000;
    await lk.key("h1");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("dopo un errore DB salta la rete per 15 s (chiavi e throttle)", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ message: "boom" }, 500));
    const lk = createLookup({ ...env, fetchFn, now: () => now });
    await lk.key("h1");
    now += 14_000;
    expect(await lk.key("h2")).toEqual({ key: null, failed: true });
    expect((await lk.throttled()).size).toBe(0);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("anche un errore del throttle apre il circuito per le chiavi", async () => {
    const fetchFn = vi.fn(async () => { throw new Error("down"); });
    const lk = createLookup({ ...env, fetchFn, now: () => now });
    await lk.throttled();
    expect((await lk.key("h1")).failed).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("cache chiavi limitata: oltre maxKeys esce la piu' vecchia", async () => {
    const fetchFn = vi.fn(async () => jsonResponse([]));
    const lk = createLookup({ ...env, fetchFn, now: () => now, maxKeys: 3 });
    for (const h of ["a", "b", "c", "d"]) await lk.key(h);
    expect(fetchFn).toHaveBeenCalledTimes(4);
    await lk.key("b");
    await lk.key("c");
    await lk.key("d");
    expect(fetchFn).toHaveBeenCalledTimes(4);
    await lk.key("a");
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });

  it("throttled restituisce l'insieme dei soggetti attivi", async () => {
    const lk = createLookup({ ...env, fetchFn: async () => jsonResponse([{ subject: "ip:abc" }, { subject: "key:eidx_live_ab12" }]), now: () => now });
    const s = await lk.throttled();
    expect(s.has("ip:abc")).toBe(true);
    expect(s.has("key:eidx_live_ab12")).toBe(true);
  });

  it("throttled con DB giu': insieme vuoto (fail-open)", async () => {
    const lk = createLookup({ ...env, fetchFn: async () => { throw new Error("down"); }, now: () => now });
    expect((await lk.throttled()).size).toBe(0);
  });
});
