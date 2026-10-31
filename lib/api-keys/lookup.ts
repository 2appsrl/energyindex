/**
 * Letture del middleware su api_keys e api_throttle via PostgREST con la
 * service role (stesso schema di lib/traffic/log.ts: niente supabase-js su
 * edge). Cache in memoria per istanza, TTL 60 s. Su errore fail-open: un DB
 * lento non deve rompere le API pubbliche.
 */

import type { KeyRecord } from "./gate";

const TTL_MS = 60_000;

interface Deps {
  url: string;
  serviceKey: string;
  fetchFn?: typeof fetch;
  now?: () => number;
}

export function createLookup({ url, serviceKey, fetchFn = fetch, now = Date.now }: Deps) {
  const keys = new Map<string, { key: KeyRecord | null; exp: number }>();
  let thr: { set: Set<string>; exp: number } | null = null;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  async function get<T>(path: string): Promise<T> {
    const res = await fetchFn(`${url}/rest/v1/${path}`, { headers, signal: AbortSignal.timeout(1500) });
    if (!res.ok) throw new Error(`postgrest ${res.status}`);
    return (await res.json()) as T;
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
        keys.set(hash, { key, exp: now() + TTL_MS });
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
