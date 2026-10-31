/**
 * Helper puri della scheda "Integrazioni" della dashboard admin (chiavi API,
 * domini del widget, chiamate senza chiave). Niente I/O: testati in
 * tests/lib/admin-integrations.test.ts.
 */

import type { KeyStatus } from "@/lib/api-keys/link-check";

export type Tone = "good" | "warn" | "bad" | "neutral";
export interface Badge {
  label: string;
  tone: Tone;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** L'id arriva dal browser: solo un UUID esatto finisce in un filtro PostgREST. */
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export interface KeyUsage {
  api_key_prefix: string;
  requests: number;
}

/**
 * Aggiunge a ogni chiave le chiamate del periodo (per prefisso). usage null =
 * conteggio non disponibile (RPC mancante): calls_30d null, la lista resta.
 */
export function mergeKeyUsage<K extends { prefix: string | null }>(
  keys: K[],
  usage: KeyUsage[] | null,
): (K & { calls_30d: number | null })[] {
  const byPrefix = new Map((usage ?? []).map((u) => [u.api_key_prefix, Number(u.requests ?? 0)]));
  return keys.map((k) => ({
    ...k,
    calls_30d: usage === null ? null : k.prefix ? (byPrefix.get(k.prefix) ?? 0) : 0,
  }));
}

const STATUS_BADGE: Record<KeyStatus, Badge> = {
  active: { label: "Attiva", tone: "good" },
  downgraded: { label: "Declassata", tone: "warn" },
  pending: { label: "Da confermare", tone: "neutral" },
  revoked: { label: "Revocata", tone: "bad" },
};

export function keyStatusBadge(status: KeyStatus): Badge {
  return STATUS_BADGE[status] ?? { label: status, tone: "neutral" };
}

export function linkBadge(linkOk: boolean | null, checkedAt: string | null): Badge {
  if (!checkedAt || linkOk === null) return { label: "Mai verificato", tone: "neutral" };
  return linkOk ? { label: "Link ok", tone: "good" } : { label: "Link assente", tone: "bad" };
}
