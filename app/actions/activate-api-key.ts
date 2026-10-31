"use server";

/**
 * Attivazione della chiave Developer dal link di verifica. Solo via POST
 * (pulsante sulla pagina /it/api/chiave/verifica): gli scanner delle email
 * aprono i link in anticipo e su GET consumerebbero il token.
 *
 * Il token e' l'unica autorizzazione: 32 caratteri casuali, monouso, 24 ore.
 */

import { activateDeveloperKey, type ActivateResult } from "@/lib/api-keys/issue";

export type ActivateState = ActivateResult | null;

export async function activateApiKey(_prev: ActivateState, formData: FormData): Promise<ActivateState> {
  const token = formData.get("t");
  if (typeof token !== "string") return { ok: false, error: "Link non valido o già usato" };
  return activateDeveloperKey(token.trim());
}
