/**
 * Verifica settimanale dell'attribuzione: per ogni chiave attiva o
 * declassata scarica la pagina dichiarata e cerca un link a energyindex.it.
 * Due fallimenti consecutivi → declassata ai limiti Open + email.
 * Eccezione: se il widget e' stato chiamato da quel dominio negli ultimi 7
 * giorni il link c'e' per forza (il widget non funziona senza).
 *
 * La logica sta in lib/api-keys/link-check-job.ts (testata); qui solo
 * Supabase e Resend. Senza RESEND_API_KEY lo stato si aggiorna lo stesso,
 * ma non parte nessuna email.
 *
 * Esce con codice 1 se non riesce a leggere le chiavi o se almeno una chiave
 * non e' stata verificata/aggiornata, cosi' il workflow risulta fallito.
 *
 * Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... [RESEND_API_KEY=...] npx tsx scripts/check-attribution-links.ts
 */
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { fetchHasLink, type KeyStatus } from "../lib/api-keys/link-check";
import { linkCheckEmail, runLinkChecks, type CheckableKey } from "../lib/api-keys/link-check-job";

const WIDGET_WINDOW_DAYS = 7;
const REPLY_TO = "pro@energyindex.pro";
const SENDER = process.env.RESEND_SENDER_EMAIL || "EIDX Pro <onboarding@resend.dev>";

async function main(): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[link-check] mancano SUPABASE_URL e/o SUPABASE_SERVICE_ROLE_KEY");
    return 1;
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) console.log("[link-check] RESEND_API_KEY non configurata: nessuna email verra' inviata");

  const { data, error } = await db
    .from("api_keys")
    .select("id, email, nome, domain, attribution_url, status, link_failures")
    .in("status", ["active", "downgraded"])
    .order("created_at", { ascending: true });
  if (error) {
    console.error(
      `[link-check] lettura di api_keys fallita: ${error.message}` +
        (error.code ? ` (${error.code})` : "") +
        ". La migrazione 20261031000001_api_keys_throttle.sql e' applicata?",
    );
    return 1;
  }
  const keys = (data ?? []).map((r) => ({ ...r, status: r.status as KeyStatus })) as CheckableKey[];

  const summary = await runLinkChecks(keys, {
    hasLink: (pageUrl) => fetchHasLink(pageUrl),

    async widgetSeen(domain) {
      const since = new Date(Date.now() - WIDGET_WINDOW_DAYS * 86_400_000).toISOString();
      const { count, error: e } = await db
        .from("traffic_log")
        .select("id", { count: "exact", head: true })
        .in("origin_host", [domain, `www.${domain}`])
        .ilike("query", "%src=widget%")
        .gt("ts", since);
      if (e) throw new Error(`traffic_log: ${e.message}`);
      return (count ?? 0) > 0;
    },

    async update(k, patch) {
      // .eq("status") evita di sovrascrivere una revoca arrivata durante il giro.
      const { error: e } = await db.from("api_keys").update(patch).eq("id", k.id).eq("status", k.status);
      if (e) throw new Error(`update api_keys: ${e.message}`);
    },

    async notify(k, kind) {
      if (!resend) return;
      const { subject, text } = linkCheckEmail(k, kind);
      const res = await resend.emails.send({ from: SENDER, to: k.email, replyTo: REPLY_TO, subject, text });
      if (res.error) throw new Error(res.error.message);
    },
  });

  console.log(JSON.stringify(summary));
  return summary.errors > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("[link-check]", e);
    process.exit(1);
  },
);
