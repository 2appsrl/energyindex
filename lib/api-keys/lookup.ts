/**
 * Letture del middleware su api_keys e api_throttle via PostgREST con la
 * service role (stesso schema di lib/traffic/log.ts: niente supabase-js su
 * edge). Cache in memoria per istanza, TTL 60 s, al massimo maxKeys chiavi.
 * Su errore fail-open: un DB lento non deve rompere le API pubbliche, e per
 * OUTAGE_MS non si riprova la rete, cosi' un DB giu' non aggiunge il timeout
 * a ogni richiesta.
 */

import type { KeyRecord } from "./gate";

const TTL_MS = 60_000;
const OUTAGE_MS = 15_000;
const MAX_KEYS = 1000;

interface Deps {
  url: string;
  serviceKey: string;
  fetchFn?: typeof fetch;
  now?: () => number;
  /** Tetto della cache chiavi: anche le chiavi sconosciute restano in cache. */
  maxKeys?: number;
}

export function createLookup({ url, serviceKey, fetchFn = fetch, now = Date.now, maxKeys = MAX_KEYS }: Deps) {
  const keys = new Map<string, { key: KeyRecord | null; exp: number }>();
  let thr: { set: Set<string>; exp: number } | null = null;
  let downUntil = 0;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  function logOutage(e: unknown, status: number) {
    const detail = e instanceof Error ? e.message : String(e);
    // PostgREST risponde 404 (PGRST205) per una tabella che non esiste: il
    // DB c'e', manca la migrazione.
    if (status === 404) {
      console.error(
        "[api-keys] tabella api_keys/api_throttle mancante, fail-open per 15 s",
        `${detail}: applica la migrazione 20261031000001_api_keys_throttle.sql`,
      );
      return;
    }
    const hint =
      status === 401 || status === 403
        ? `${detail}: sembra un errore di configurazione (service key mancante o errata)`
        : detail;
    console.error("[api-keys] postgrest non raggiungibile, fail-open per 15 s", hint);
  }

  async function get<T>(path: string): Promise<T> {
    if (downUntil > now()) throw new Error("postgrest down");
    let status = 0;
    try {
      const res = await fetchFn(`${url}/rest/v1/${path}`, { headers, signal: AbortSignal.timeout(1500) });
      if (!res.ok) {
        status = res.status;
        throw new Error(`postgrest ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (e) {
      // Un solo log per guasto: solo quando il circuito passa da chiuso ad
      // aperto, non per ogni richiesta che arriva mentre e' aperto.
      if (downUntil <= now()) logOutage(e, status);
      downUntil = now() + OUTAGE_MS;
      throw e;
    }
  }

  function remember(hash: string, key: KeyRecord | null) {
    keys.delete(hash);
    if (keys.size >= maxKeys) {
      const oldest = keys.keys().next();
      if (!oldest.done) keys.delete(oldest.value);
    }
    keys.set(hash, { key, exp: now() + TTL_MS });
  }

  return {
    async key(hash: string): Promise<{ key: KeyRecord | null; failed: boolean }> {
      const hit = keys.get(hash);
      if (hit && hit.exp > now()) return { key: hit.key, failed: false };
      try {
        const rows = await get<KeyRecord[]>(
          `api_keys?key_hash=eq.${encodeURIComponent(hash)}&select=prefix,status,domain,plan&limit=1`,
        );
        const key = rows[0] ?? null;
        remember(hash, key);
        return { key, failed: false };
      } catch {
        return { key: null, failed: true };
      }
    },

    async throttled(): Promise<Set<string>> {
      if (thr && thr.exp > now()) return thr.set;
      try {
        const rows = await get<{ subject: string }[]>(
          `api_throttle?until=gt.${encodeURIComponent(new Date(now()).toISOString())}&select=subject`,
        );
        thr = { set: new Set(rows.map((r) => r.subject)), exp: now() + TTL_MS };
        return thr.set;
      } catch {
        return new Set();
      }
    },
  };
}

let shared: ReturnType<typeof createLookup> | null = null;

/** Istanza condivisa del modulo (una per isolate edge). Null senza env. */
export function sharedLookup() {
  if (shared) return shared;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  shared = createLookup({ url, serviceKey });
  return shared;
}
