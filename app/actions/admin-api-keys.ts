"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { isUuid } from "@/lib/admin/integrations";
import { fetchHasLink, nextManualLinkState, type KeyStatus } from "@/lib/api-keys/link-check";
import { widgetHostFilter, widgetSeenFromRows } from "@/lib/api-keys/link-check-job";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Azioni admin sulle chiavi API (scheda Integrazioni). Ogni azione chiama
 * requireAdmin() per prima: chi non e' admin viene rediretto al login prima
 * di qualsiasi lettura. Nessuna email parte da qui, nemmeno quando una
 * verifica manuale declassa o riattiva una chiave.
 */

export type AdminKeyResult = { ok: true; message: string } | { ok: false; error: string };

const NO_CLIENT = "SUPABASE_SERVICE_ROLE_KEY non configurata sul server.";
const BAD_ID = "Identificativo della chiave non valido.";
/** Budget della verifica dal pannello: l'admin aspetta la risposta. */
const RECHECK_BUDGET_MS = 5_000;
/** Stessa finestra e stesso tetto della verifica settimanale. */
const WIDGET_WINDOW_DAYS = 7;
const WIDGET_ROWS_LIMIT = 200;

/** Revoca: il middleware se ne accorge entro 60 s (cache del lookup). */
export async function revokeApiKey(id: string): Promise<AdminKeyResult> {
  await requireAdmin();
  if (!isUuid(id)) return { ok: false, error: BAD_ID };
  const db = createServiceClient();
  if (!db) return { ok: false, error: NO_CLIENT };

  const { data, error } = await db
    .from("api_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "revoked")
    .select("id");
  if (error) {
    console.error("[revokeApiKey]", error.message);
    return { ok: false, error: `Revoca non riuscita: ${error.message}` };
  }
  if ((data?.length ?? 0) === 0) return { ok: false, error: "Chiave non trovata o gia' revocata." };
  revalidatePath("/it/admin");
  return { ok: true, message: "Chiave revocata: smette di funzionare entro un minuto." };
}

/**
 * Ricontrolla subito l'attribuzione di una chiave, con la stessa regola della
 * verifica settimanale: link nella pagina dichiarata oppure widget caricato
 * dal dominio. A differenza della verifica settimanale puo' solo riattivare:
 * un link assente aggiorna link_ok e link_checked_at ma non conta come
 * fallimento e non declassa. Una riattivazione manuale non manda email.
 * Gli update sono protetti dallo stato letto, cosi' una revoca (o la verifica
 * settimanale) arrivata nel frattempo non viene sovrascritta.
 */
export async function recheckApiKeyLink(id: string): Promise<AdminKeyResult> {
  await requireAdmin();
  if (!isUuid(id)) return { ok: false, error: BAD_ID };
  const db = createServiceClient();
  if (!db) return { ok: false, error: NO_CLIENT };

  const { data: key, error: readErr } = await db
    .from("api_keys")
    .select("id, domain, attribution_url, status, link_failures")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, error: `Lettura della chiave non riuscita: ${readErr.message}` };
  if (!key) return { ok: false, error: "Chiave non trovata." };
  const status = key.status as KeyStatus;
  if (status === "revoked" || status === "pending") {
    return { ok: false, error: "Chiave revocata o non ancora confermata: niente da verificare." };
  }

  let ok = await fetchHasLink(String(key.attribution_url), undefined, RECHECK_BUDGET_MS);
  if (!ok) {
    const hosts = widgetHostFilter(String(key.domain));
    if (hosts) {
      const since = new Date(Date.now() - WIDGET_WINDOW_DAYS * 86_400_000).toISOString();
      const { data: rows, error: e } = await db
        .from("traffic_log")
        .select("origin_host, ip_hash")
        .eq("kind", "api")
        .or(hosts)
        .ilike("query", "%src=widget%")
        .not("ip_hash", "is", null)
        .gt("ts", since)
        .order("ts", { ascending: false })
        .limit(WIDGET_ROWS_LIMIT);
      // Senza traffic_log non sappiamo se il widget c'e': meglio non contare un fallimento.
      if (e) return { ok: false, error: `Lettura di traffic_log non riuscita: ${e.message}` };
      ok = widgetSeenFromRows(rows ?? [], String(key.domain));
    }
  }

  const next = nextManualLinkState({ status, link_failures: Number(key.link_failures ?? 0) }, ok);
  const checked = { link_ok: ok, link_checked_at: new Date().toISOString() };
  let update = db
    .from("api_keys")
    .update(ok ? { ...checked, status: next.status, link_failures: next.link_failures } : checked)
    .eq("id", id)
    .eq("status", status);
  if (ok) update = update.eq("link_failures", key.link_failures);
  const { data: saved, error: updErr } = await update.select("id");
  if (updErr) return { ok: false, error: `Aggiornamento non riuscito: ${updErr.message}` };
  if ((saved?.length ?? 0) === 0) return { ok: false, error: "La chiave e' cambiata nel frattempo: ricarica la pagina." };
  revalidatePath("/it/admin");

  if (!ok) return { ok: true, message: "Link non trovato. Lo stato non cambia: decide la verifica settimanale." };
  return { ok: true, message: next.notify === "restored" ? "Link trovato: chiave riattivata." : "Link trovato." };
}
