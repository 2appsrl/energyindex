/**
 * Porta la posta di pro@energyindex.pro nella sezione Mail di /it/admin.
 *
 *  1. Legge la INBOX via IMAP in sola lettura: nessun messaggio viene segnato
 *     come letto, spostato o cancellato sulla casella.
 *  2. Salva i messaggi nuovi in inbound_emails (doppioni esclusi dal Message-ID).
 *  3. Classifica con Claude quelli senza analisi e prepara la bozza di risposta.
 *     Non invia niente: le risposte le manda il titolare.
 *
 * ATTENZIONE: il repository e' pubblico e con lui i log delle Actions. Qui si
 * stampano solo conteggi, mai mittenti, oggetti o testi.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MAIL_IMAP_USER, MAIL_IMAP_PASSWORD,
 *      ANTHROPIC_API_KEY (senza: i messaggi entrano ma restano da analizzare).
 *      Facoltative: MAIL_IMAP_HOST, MAIL_SYNC_SINCE_DAYS.
 * Cron: .github/workflows/sync-mail-pro.yml
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import { MAIL_ANALYSIS_MODEL, MailAnalysisError, analyzeEmail, type EmailToAnalyze } from "@/lib/mail/analyze";
import { parseRawEmail, type ParsedEmail } from "@/lib/mail/parse";
import { MAIL_SYNC_SOURCE, describeImapError } from "@/lib/mail/types";

// Il server IMAP di register.it (MX mail.register.it) ha un certificato
// *.securemail.pro: con questo nome la verifica TLS passa senza eccezioni.
const DEFAULT_IMAP_HOST = "mail.securemail.pro";
const MAX_NEW_PER_RUN = 50;
/** Tetto di costo: quel che resta si analizza alla sincronizzazione successiva. */
const MAX_ANALYSES_PER_RUN = 20;
const MAX_ANALYSIS_ATTEMPTS = 3;

async function fetchNewEmails(db: SupabaseClient): Promise<ParsedEmail[]> {
  const days = Number(process.env.MAIL_SYNC_SINCE_DAYS) || 60;
  const client = new ImapFlow({
    host: process.env.MAIL_IMAP_HOST || DEFAULT_IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: process.env.MAIL_IMAP_USER!, pass: process.env.MAIL_IMAP_PASSWORD! },
    logger: false, // il logger di imapflow scriverebbe indirizzi e oggetti nei log pubblici
  });

  await client.connect();
  try {
    await client.mailboxOpen("INBOX", { readOnly: true });
    const uids = await client.search({ since: new Date(Date.now() - days * 86_400_000) }, { uid: true });
    if (!uids || uids.length === 0) return [];

    const seen: { uid: number; messageId?: string; date?: Date }[] = [];
    for await (const m of client.fetch(uids, { uid: true, envelope: true }, { uid: true })) {
      const date = m.envelope?.date;
      seen.push({ uid: m.uid, messageId: m.envelope?.messageId, date: date ? new Date(date) : undefined });
    }

    const ids = seen.flatMap((m) => (m.messageId ? [m.messageId] : []));
    const { data: existing, error } = await db.from("inbound_emails").select("message_id").in("message_id", ids);
    if (error) throw new Error(`lettura inbound_emails: ${error.message}`);
    const known = new Set((existing ?? []).map((r) => r.message_id as string));

    const fresh = seen.filter((m) => !m.messageId || !known.has(m.messageId)).slice(0, MAX_NEW_PER_RUN);
    if (fresh.length === 0) return [];

    const parsed: ParsedEmail[] = [];
    const dates = new Map(fresh.map((m) => [m.uid, m.date]));
    for await (const m of client.fetch(fresh.map((f) => f.uid), { uid: true, source: true }, { uid: true })) {
      if (m.source) parsed.push(await parseRawEmail(m.source, dates.get(m.uid)));
    }
    return parsed;
  } finally {
    await client.logout().catch(() => client.close());
  }
}

async function analyzePending(db: SupabaseClient, anthropic: Anthropic): Promise<{ analyzed: number; failed: number }> {
  const { data, error } = await db
    .from("inbound_emails")
    .select("id, from_name, from_email, reply_to, received_at, subject, body_text, attachment_names, analysis_attempts")
    .is("analyzed_at", null)
    .lt("analysis_attempts", MAX_ANALYSIS_ATTEMPTS)
    .order("received_at", { ascending: false })
    .limit(MAX_ANALYSES_PER_RUN);
  if (error) throw new Error(`lettura coda analisi: ${error.message}`);

  let analyzed = 0;
  let failed = 0;
  for (const row of (data ?? []) as (EmailToAnalyze & { id: number; analysis_attempts: number })[]) {
    const now = new Date().toISOString();
    try {
      const a = await analyzeEmail(anthropic, row);
      const { error: saveError } = await db
        .from("inbound_emails")
        .update({
          category: a.category,
          priority: a.priority,
          summary: a.summary,
          reply_subject: a.reply_subject || null,
          reply_draft: a.reply_draft || null,
          review_note: a.review_note || null,
          analyzed_at: now,
          analysis_model: MAIL_ANALYSIS_MODEL,
          analysis_attempts: row.analysis_attempts + 1,
          analysis_error: null,
          updated_at: now,
        })
        .eq("id", row.id);
      if (saveError) throw new Error(`salvataggio analisi: ${saveError.message}`);
      analyzed += 1;
    } catch (e) {
      failed += 1;
      const message = errorText(e);
      console.error(`[sync-mail-pro] analisi non riuscita per la riga ${row.id}: ${message}`);
      await db
        .from("inbound_emails")
        .update({ analysis_attempts: row.analysis_attempts + 1, analysis_error: message, updated_at: now })
        .eq("id", row.id);
      // Chiave errata o credito finito: inutile consumare i tentativi degli altri messaggi.
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) break;
    }
  }
  return { analyzed, failed };
}

/** Testo di errore sicuro per log pubblici: mai il contenuto del messaggio. */
function errorText(e: unknown): string {
  if (e instanceof MailAnalysisError) return e.message;
  if (e instanceof Anthropic.APIError) return `API Claude: errore ${e.status ?? "di rete"}`;
  const imap = describeImapError(e);
  if (imap) return imap;
  return e instanceof Error ? e.message.slice(0, 300) : "errore sconosciuto";
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti");
  // Casella non ancora collegata: il cron non deve fallire ogni 15 minuti.
  // La scheda Mail mostra "mai sincronizzata" con le istruzioni.
  if (!process.env.MAIL_IMAP_USER || !process.env.MAIL_IMAP_PASSWORD) {
    console.log("[sync-mail-pro] MAIL_IMAP_USER/MAIL_IMAP_PASSWORD non configurate: niente da fare.");
    return;
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: run } = await db
    .from("etl_runs")
    .insert({ source: MAIL_SYNC_SOURCE, status: "running" })
    .select("id")
    .single();
  const finish = async (status: "ok" | "error", rows: number, error?: string, metadata?: object) => {
    if (!run) return;
    await db
      .from("etl_runs")
      .update({ status, rows_ingested: rows, error_message: error ?? null, finished_at: new Date().toISOString(), metadata: metadata ?? {} })
      .eq("id", run.id);
  };

  let imported = 0;
  try {
    const emails = await fetchNewEmails(db);
    if (emails.length > 0) {
      const { error, count } = await db
        .from("inbound_emails")
        .upsert(emails, { onConflict: "message_id", ignoreDuplicates: true, count: "exact" });
      if (error) throw new Error(`salvataggio messaggi: ${error.message}`);
      imported = count ?? emails.length;
    }

    let analysis = { analyzed: 0, failed: 0 };
    if (process.env.ANTHROPIC_API_KEY) {
      analysis = await analyzePending(db, new Anthropic());
    } else {
      console.log("[sync-mail-pro] ANTHROPIC_API_KEY non configurata: messaggi salvati senza analisi.");
    }

    console.log(`[sync-mail-pro] nuovi: ${imported}, analizzati: ${analysis.analyzed}, analisi fallite: ${analysis.failed}`);
    await finish("ok", imported, analysis.failed ? `${analysis.failed} analisi non riuscite` : undefined, analysis);
  } catch (e) {
    const message = errorText(e);
    await finish("error", imported, message);
    throw new Error(message);
  }
}

main().catch((e) => {
  console.error("[sync-mail-pro]", e instanceof Error ? e.message : "errore sconosciuto");
  process.exit(1);
});
