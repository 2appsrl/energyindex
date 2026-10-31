/**
 * Verifica dell'attribuzione: la pagina dichiarata da chi ha una chiave deve
 * contenere un <a> verso energyindex.it. Accettiamo qualsiasi rel (anche
 * nofollow): pretendere un dofollow in cambio dell'accesso violerebbe le
 * policy di Google sui link scheme.
 */

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
