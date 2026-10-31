/**
 * Verifica settimanale dell'attribuzione: per ogni chiave Developer attiva o
 * declassata scarica la pagina dichiarata e cerca un link a energyindex.it.
 * Dal piano API in su l'attribuzione e' facoltativa: quelle chiavi non si
 * verificano.
 * Due fallimenti consecutivi → declassata ai limiti Open + email.
 * Eccezione: se il widget e' stato chiamato da quel dominio (o da un suo
 * sottodominio) negli ultimi 7 giorni da almeno 2 visitatori distinti, il
 * link c'e' per forza (il widget non funziona senza).
 *
 * La logica sta in lib/api-keys/link-check-job.ts (testata); qui solo
 * Supabase e Resend. Senza RESEND_API_KEY lo stato si aggiorna lo stesso,
 * ma non parte nessuna email.
 *
 * Esce con codice 1 se non riesce a leggere le chiavi, se almeno una chiave
 * non e' stata verificata/aggiornata o se un'email non e' partita, cosi' il
 * workflow risulta fallito.
 *
 * Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... [RESEND_API_KEY=...] npx tsx scripts/check-attribution-links.ts
 */
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { fetchHasLink, type KeyStatus } from "../lib/api-keys/link-check";
import {
  linkCheckEmail,
  runLinkChecks,
  widgetHostFilter,
  widgetSeenFromRows,
  type CheckableKey,
} from "../lib/api-keys/link-check-job";

const WIDGET_WINDOW_DAYS = 7;
const WIDGET_ROWS_LIMIT = 200;
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
    .eq("plan", "developer")
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
      const hosts = widgetHostFilter(domain);
      if (!hosts) return false;
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
      if (e) throw new Error(`traffic_log: ${e.message}`);
      return widgetSeenFromRows(rows ?? [], domain);
    },

    async update(k, patch) {
      // .eq("status") evita di sovrascrivere una revoca arrivata durante il giro.
      // Un update filtrato che non trova righe non da' errore: lo dice data vuoto.
      const { data: rows, error: e } = await db
        .from("api_keys")
        .update(patch)
        .eq("id", k.id)
        .eq("status", k.status)
        .select("id");
      if (e) throw new Error(`update api_keys: ${e.message}`);
      return (rows?.length ?? 0) > 0;
    },

    async notify(k, kind) {
      if (!resend) return;
      const { subject, text } = linkCheckEmail(k, kind);
      try {
        const res = await resend.emails.send({ from: SENDER, to: k.email, replyTo: REPLY_TO, subject, text });
        if (res.error) throw new Error(res.error.message);
      } catch (e) {
        // Le email perse devono vedersi nel riepilogo di GitHub Actions.
        const why = (e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, " ");
        console.log(`::warning::Email "${kind}" non inviata per la chiave ${k.id} (${k.domain}): ${why}`);
        throw e;
      }
    },
  });

  console.log(JSON.stringify(summary));
  return summary.errors > 0 || summary.notifyErrors > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("[link-check]", e);
    process.exit(1);
  },
);
