"use server";

/**
 * Attivazione della chiave Developer dal link di verifica. Solo via POST
 * (pulsante sulla pagina /it/api/chiave/verifica): gli scanner delle email
 * aprono i link in anticipo e su GET consumerebbero il token.
 *
 * Il token e' l'unica autorizzazione (32 caratteri casuali, monouso, 24 ore)
 * e arriva dal cookie HttpOnly impostato dal middleware, non dall'URL.
 */

import { cookies } from "next/headers";
import { activateDeveloperKey, type ActivateResult } from "@/lib/api-keys/issue";
import { VERIFY_COOKIE, VERIFY_COOKIE_PATH, isVerifyToken } from "@/lib/api-keys/verify-redirect";

export type ActivateState = ActivateResult | null;

export async function activateApiKey(prev: ActivateState): Promise<ActivateState> {
  // Chiave gia' mostrata: un secondo invio non deve sostituirla con un errore.
  if (prev?.ok) return prev;
  const store = await cookies();
  const token = store.get(VERIFY_COOKIE)?.value ?? "";
  if (!isVerifyToken(token)) return { ok: false, error: "Link non valido o già usato" };
  const res = await activateDeveloperKey(token);
  if (res.ok) {
    store.set(VERIFY_COOKIE, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: VERIFY_COOKIE_PATH,
      maxAge: 0,
    });
  }
  return res;
}
