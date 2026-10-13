/**
 * Scrittura di una riga in traffic_log dal middleware (runtime edge).
 *
 * Niente supabase-js: una sola POST a PostgREST con la service role key,
 * lanciata in background con event.waitUntil() cosi' la risposta al client
 * non aspetta il database. Se l'env non e' configurata o il DB non risponde
 * la richiesta originale non ne risente: il log si perde e basta.
 */

import { classifyAgent, type AgentKind } from "./classify";

export interface TrafficRecord {
  kind: "api" | "bot";
  path: string;
  query: string | null;
  method: string;
  origin_host: string | null;
  referer_host: string | null;
  user_agent: string | null;
  agent: string;
  agent_kind: AgentKind;
  country: string | null;
  ip_hash: string | null;
  api_key_prefix: string | null;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase() || null;
  } catch {
    return null;
  }
}

/** IP del client: header Netlify, poi il primo di x-forwarded-for. */
export function clientIp(headers: Headers): string | null {
  return (
    headers.get("x-nf-client-connection-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null
  );
}

/** Paese: header x-country di Netlify, altrimenti il JSON base64 di x-nf-geo. */
export function clientCountry(headers: Headers): string | null {
  const direct = headers.get("x-country");
  if (direct) return direct.toUpperCase();
  const geo = headers.get("x-nf-geo");
  if (!geo) return null;
  try {
    const parsed = JSON.parse(atob(geo)) as { country?: { code?: string } };
    return parsed.country?.code?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

/** Primi 14 caratteri della chiave (es. "eidx_live_ab12"): identifica senza esporre. */
export function apiKeyPrefix(headers: Headers, searchParams: URLSearchParams): string | null {
  const bearer = headers.get("authorization")?.match(/^Bearer\s+(\S+)/i)?.[1];
  const key = bearer ?? searchParams.get("key");
  return key ? key.slice(0, 14) : null;
}

/** Toglie dalla querystring la chiave API, che non deve finire nei log. */
export function redactQuery(searchParams: URLSearchParams): string | null {
  const copy = new URLSearchParams(searchParams);
  if (copy.has("key")) copy.set("key", "REDACTED");
  const s = copy.toString();
  return s ? s.slice(0, 500) : null;
}

/**
 * Hash giornaliero dell'IP. Il giorno fa parte dell'input, quindi la
 * stessa persona ha impronte diverse in giorni diversi: si contano i
 * visitatori unici del giorno ma non si puo' seguire nessuno nel tempo.
 */
export async function hashIp(ip: string | null, salt: string, now = new Date()): Promise<string | null> {
  if (!ip) return null;
  const day = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  const data = new TextEncoder().encode(`${ip}|${day}|${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildRecord(
  kind: "api" | "bot",
  request: { method: string; headers: Headers; nextUrl: { pathname: string; searchParams: URLSearchParams } },
  salt: string,
): Promise<TrafficRecord> {
  const { headers, nextUrl } = request;
  const ua = headers.get("user-agent");
  const { agent, kind: agentKind } = classifyAgent(ua);
  return {
    kind,
    path: nextUrl.pathname.slice(0, 300),
    query: redactQuery(nextUrl.searchParams),
    method: request.method,
    origin_host: hostOf(headers.get("origin")),
    referer_host: hostOf(headers.get("referer")),
    user_agent: ua ? ua.slice(0, 400) : null,
    agent,
    agent_kind: agentKind,
    country: clientCountry(headers),
    ip_hash: await hashIp(clientIp(headers), salt),
    api_key_prefix: apiKeyPrefix(headers, nextUrl.searchParams),
  };
}

export async function writeRecord(record: TrafficRecord): Promise<void> {
  // In locale .env.local punta al DB di produzione: niente log dal dev server.
  if (process.env.NODE_ENV === "development") return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/traffic_log`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Log perso: meglio che rallentare o rompere la richiesta dell'utente.
  }
}

/** Sale per l'hash IP: variabile dedicata, altrimenti derivato dalla service key. */
export function hashSalt(): string {
  return process.env.TRAFFIC_HASH_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-24) ?? "eidx";
}
