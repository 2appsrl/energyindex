/**
 * Link di verifica: il token arriva in querystring (?t=…) ma non deve
 * restare nell'URL, che gli script lato client (Umami) e i log leggono.
 * Il middleware lo sposta in un cookie HttpOnly e fa redirect all'URL
 * pulito, prima che parta qualsiasi script. Edge-safe, senza dipendenze.
 */

export const VERIFY_PATH = "/it/api/chiave/verifica";
export const VERIFY_COOKIE = "eidx_verify";
export const VERIFY_COOKIE_PATH = "/it/api/chiave";
export const VERIFY_COOKIE_MAX_AGE = 86_400;

/** 32 caratteri base62, come generateApiKey().slice(10). */
const TOKEN_RE = /^[0-9A-Za-z]{32}$/;

export function isVerifyToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

/**
 * null: nessun redirect. Altrimenti l'URL pulito e il token da salvare nel
 * cookie (null se malformato: il cookie va cancellato).
 */
export function verifyTokenRedirect(
  pathname: string,
  searchParams: URLSearchParams,
): { location: string; token: string | null } | null {
  if (pathname !== VERIFY_PATH || !searchParams.has("t")) return null;
  const t = (searchParams.get("t") ?? "").trim();
  return { location: VERIFY_PATH, token: isVerifyToken(t) ? t : null };
}
