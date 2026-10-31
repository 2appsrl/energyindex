/**
 * Verifica dell'attribuzione: la pagina dichiarata da chi ha una chiave deve
 * contenere un <a> verso energyindex.it. Accettiamo qualsiasi rel (anche
 * nofollow): pretendere un dofollow in cambio dell'accesso violerebbe le
 * policy di Google sui link scheme.
 *
 * Niente "server-only": lo usa anche lo script della verifica settimanale.
 */

import { normalizeDomain } from "./keys";

// (?<![\w-]) esclude attributi come data-href, che non producono un link.
const LINK_RE = /<a\b[^>]*(?<![\w-])href\s*=\s*["']?(?:https?:)?\/\/(?:www\.)?energyindex\.(?:it|pro)(?=[\/"'\s>?#]|$)/i;

export function hasEnergyIndexLink(html: string): boolean {
  return LINK_RE.test(html.replace(/<!--[\s\S]*?-->/g, ""));
}

export type KeyStatus = "pending" | "active" | "downgraded" | "revoked";

export interface LinkState {
  status: KeyStatus;
  link_failures: number;
}

export const FAILURES_BEFORE_DOWNGRADE = 2;

export function nextLinkState(
  cur: LinkState,
  ok: boolean,
): LinkState & { notify: "downgraded" | "restored" | null } {
  // Le chiavi revocate o non ancora confermate non cambiano per effetto del link.
  if (cur.status === "revoked" || cur.status === "pending") return { ...cur, notify: null };
  if (ok) {
    return { status: "active", link_failures: 0, notify: cur.status === "downgraded" ? "restored" : null };
  }
  const failures = cur.link_failures + 1;
  if (cur.status === "active" && failures >= FAILURES_BEFORE_DOWNGRADE) {
    return { status: "downgraded", link_failures: failures, notify: "downgraded" };
  }
  return { status: cur.status, link_failures: failures, notify: null };
}

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "EnergyIndexLinkCheck/1.0 (+https://energyindex.it/it/api/docs#licenza)";

/**
 * URL che il link checker puo' scaricare. Difesa SSRF: solo http/https sulle
 * porte standard, niente credenziali, e un host che sia un dominio pubblico
 * (normalizeDomain scarta IP, localhost e host a un'etichetta). Non protegge
 * da un dominio pubblico il cui DNS punta a un indirizzo interno.
 */
export function isCheckableUrl(u: URL): boolean {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.username || u.password) return false;
  if (u.port !== "" && u.port !== "80" && u.port !== "443") return false;
  return normalizeDomain(u.hostname) !== null;
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  let bytes = 0;
  try {
    while (bytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.byteLength + bytes > maxBytes ? value.subarray(0, maxBytes - bytes) : value;
      bytes += chunk.byteLength;
      out += decoder.decode(chunk, { stream: true });
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return out + decoder.decode();
}

/**
 * Scarica la pagina di attribuzione e cerca il link. I redirect si seguono a
 * mano (massimo 3) per validare ogni salto prima di richiederlo. Un unico
 * timeout (budgetMs) copre tutti i salti e la lettura del corpo. Non lancia:
 * qualsiasi errore vale "link non trovato".
 */
export async function fetchHasLink(
  url: string,
  fetchImpl: typeof fetch = fetch,
  budgetMs: number = TIMEOUT_MS,
): Promise<boolean> {
  const signal = AbortSignal.timeout(budgetMs);
  let current: URL;
  try {
    current = new URL(url.trim());
  } catch {
    return false;
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isCheckableUrl(current)) return false;
    try {
      const res = await fetchImpl(current.toString(), {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        redirect: "manual",
        signal,
      });
      if (res.status >= 300 && res.status < 400) {
        res.body?.cancel().catch(() => {});
        const location = res.headers.get("location");
        if (!location) return false;
        current = new URL(location, current);
        continue;
      }
      if (!res.ok) {
        res.body?.cancel().catch(() => {});
        return false;
      }
      return hasEnergyIndexLink(await readCapped(res, MAX_BODY_BYTES));
    } catch {
      return false;
    }
  }
  return false;
}
