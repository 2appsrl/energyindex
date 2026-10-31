/**
 * Primitive delle chiavi API. Edge-safe (solo Web Crypto): le usano sia il
 * middleware sia le server action.
 *
 * Nel DB si salva solo sha256(chiave). Il prefisso visibile ha 14 caratteri
 * come api_key_prefix di traffic_log, cosi' log e chiavi si incrociano.
 */

export const KEY_PREFIX = "eidx_live_";
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 32 caratteri base62 con rejection sampling (niente bias di modulo). */
export function generateApiKey(): string {
  let out = "";
  while (out.length < 32) {
    for (const b of crypto.getRandomValues(new Uint8Array(48))) {
      if (b < 248 && out.length < 32) out += ALPHABET[b % 62];
    }
  }
  return KEY_PREFIX + out;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function keyDisplayPrefix(key: string): string {
  return key.slice(0, 14);
}

/** Host normalizzato (minuscolo, senza www., senza porta e path) o null se non e' un dominio pubblico. */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  let host: string;
  try {
    host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return null;
  return host;
}

const DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** originHost come in traffic_log (host[:porta]). */
export function originAllowed(originHost: string, domain: string): boolean {
  const host = originHost.toLowerCase().split(":")[0];
  if (DEV_HOSTS.has(host)) return true;
  return host === domain || host.endsWith(`.${domain}`);
}
