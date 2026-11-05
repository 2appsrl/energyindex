/**
 * Decisione di accesso alle API pubbliche, pura: il middleware raccoglie
 * chiave, Origin e stato di throttle e applica il risultato.
 */

import { originAllowed } from "./keys";
import type { KeyStatus } from "./link-check";

export interface KeyRecord {
  prefix: string;
  status: KeyStatus;
  domain: string;
  plan: string;
}

export interface GateInput {
  hasKey: boolean;
  key: KeyRecord | null;
  /** Lookup fallito (DB irraggiungibile): non si punisce l'utente. */
  lookupFailed: boolean;
  originHost: string | null;
  throttledKey: boolean;
  /** La chiave ha superato il limite sui soli percorsi con dati GME. */
  throttledGmeKey?: boolean;
  /** Richiesta su un percorso con dati GME (vedi isGmeDataPath). */
  gmeData?: boolean;
  throttledIp: boolean;
  /**
   * false = throttle in sola osservazione: chi e' oltre quota passa lo
   * stesso, con X-EIDX-Throttle: observe. Non tocca i controlli su chiave
   * e Origin (401/403).
   */
  enforceThrottle: boolean;
}

export type GateResult =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; status: 401 | 403 | 429; body: { error: string; message: string; attribution: string }; headers: Record<string, string> };

/** Uguali a TIERS.rateLimit in lib/api/catalog.ts e a api_plan_rate_per_minute(). */
export const RATE_PER_MINUTE: Record<string, number> = {
  open: 60,
  developer: 120,
  api: 600,
  pro: 1200,
  trading: 3000,
  enterprise: 100000,
};

/**
 * PUN e PSV non sono in vendita: su questi percorsi nessun piano a pagamento
 * ha piu' richieste del Developer gratuito. Il pattern e' lo stesso della
 * migrazione 20261105000003, un test li tiene allineati.
 */
export const GME_PATH_PATTERN = "^/api/v1/(pun|psv|today|prices/(pun|psv))(/|$)";
const GME_PATH_RE = new RegExp(GME_PATH_PATTERN);

export function isGmeDataPath(path: string): boolean {
  return GME_PATH_RE.test(path);
}

/** Header che il JavaScript di un altro sito puo' leggere dalle risposte CORS. */
export const API_EXPOSE_HEADERS = "X-RateLimit-Limit, X-EIDX-Key-Status, X-EIDX-Notice, Retry-After";

const ATTR = "Energy Index — https://energyindex.it";
const THROTTLE_SECONDS = 900;

function deny(status: 401 | 403 | 429, error: string, message: string, headers: Record<string, string> = {}): GateResult {
  return { ok: false, status, body: { error, message, attribution: ATTR }, headers };
}

export function decideAccess(i: GateInput): GateResult {
  if (i.hasKey && !i.lookupFailed) {
    if (i.key?.status === "pending") {
      return deny(401, "invalid_key", "Chiave non ancora attivata: conferma il link ricevuto via email.");
    }
    if (!i.key || i.key.status === "revoked") {
      return deny(401, "invalid_key", "Chiave API non valida o revocata.");
    }
    if (i.originHost && !originAllowed(i.originHost, i.key.domain)) {
      return deny(403, "origin_not_allowed", `Questa chiave e' abilitata solo per ${i.key.domain}.`);
    }
  }

  const activeKey = i.key && i.key.status === "active" && !i.lookupFailed ? i.key : null;
  const tier = activeKey ? activeKey.plan : "open";
  const planRate = RATE_PER_MINUTE[tier] ?? 60;
  const rate = i.gmeData ? Math.min(planRate, RATE_PER_MINUTE.developer) : planRate;
  const headers: Record<string, string> = { "X-RateLimit-Limit": String(rate) };
  if (i.key && !i.lookupFailed) headers["X-EIDX-Key-Status"] = i.key.status;
  if (i.key?.status === "downgraded") headers["X-EIDX-Notice"] = "attribution-missing";

  const throttled = activeKey ? i.throttledKey || Boolean(i.gmeData && i.throttledGmeKey) : i.throttledIp;
  if (throttled && !i.enforceThrottle) {
    return { ok: true, headers: { ...headers, "X-EIDX-Throttle": "observe" } };
  }
  if (throttled) {
    return deny(429, "rate_limited", "Limite di richieste superato. Riprova tra qualche minuto.", {
      ...headers,
      "Retry-After": String(THROTTLE_SECONDS),
    });
  }
  return { ok: true, headers };
}
