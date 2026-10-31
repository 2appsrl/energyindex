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
  throttledIp: boolean;
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

const ATTR = "Energy Index — https://energyindex.it";
const THROTTLE_SECONDS = 900;

function deny(status: 401 | 403 | 429, error: string, message: string, headers: Record<string, string> = {}): GateResult {
  return { ok: false, status, body: { error, message, attribution: ATTR }, headers };
}

export function decideAccess(i: GateInput): GateResult {
  if (i.hasKey && !i.lookupFailed) {
    if (!i.key || i.key.status === "revoked" || i.key.status === "pending") {
      return deny(401, "invalid_key", "Chiave API non valida o revocata.");
    }
    if (i.originHost && !originAllowed(i.originHost, i.key.domain)) {
      return deny(403, "origin_not_allowed", `Questa chiave e' abilitata solo per ${i.key.domain}.`);
    }
  }

  const activeKey = i.key && i.key.status === "active" && !i.lookupFailed ? i.key : null;
  const tier = activeKey ? activeKey.plan : "open";
  const headers: Record<string, string> = { "X-RateLimit-Limit": String(RATE_PER_MINUTE[tier] ?? 60) };
  if (i.key && !i.lookupFailed) headers["X-EIDX-Key-Status"] = i.key.status;
  if (i.key?.status === "downgraded") headers["X-EIDX-Notice"] = "attribution-missing";

  const throttled = activeKey ? i.throttledKey : i.throttledIp;
  if (throttled) {
    return deny(429, "rate_limited", "Limite di richieste superato. Riprova tra qualche minuto.", {
      ...headers,
      "Retry-After": String(THROTTLE_SECONDS),
    });
  }
  return { ok: true, headers };
}
