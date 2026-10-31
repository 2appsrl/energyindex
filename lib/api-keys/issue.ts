import "server-only";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/service";
import { generateApiKey, hostMatchesDomain, keyDisplayPrefix, normalizeDomain, sha256Hex } from "./keys";
import { fetchHasLink, isCheckableUrl } from "./link-check";
import { isVerifyToken } from "./verify-redirect";

/**
 * Rilascio self-service delle chiavi Developer: richiesta pending con token
 * di verifica via email, poi attivazione (solo su POST) che genera la chiave.
 */

export interface DeveloperRequest {
  nome: string;
  email: string;
  azienda?: string;
  dominio: string;
  attributionUrl: string;
  progetto: string;
}

export const CONTACT_EMAIL = "pro@energyindex.pro";
const MAX_URL_LENGTH = 2048;
const VERIFY_TTL_MS = 24 * 3600_000;
const MAX_REQUESTS_PER_EMAIL_PER_DAY = 3;
/** Tetto globale di richieste all'ora: oltre, il self-service si ferma. */
const MAX_REQUESTS_PER_HOUR = 30;
const MAX_NOME = 100;

/** Nome usato nelle email: niente a capo o caratteri di controllo, max 100 caratteri. */
export function sanitizeName(nome: string): string {
  return nome.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_NOME);
}

/**
 * Controlli comuni a tutti i piani. Le server action ricevono payload
 * arbitrari: ogni campo va verificato come stringa prima di usarlo.
 */
export function validateContactFields(d: unknown): string | null {
  if (!d || typeof d !== "object") return "Richiesta non valida";
  const r = d as Record<string, unknown>;
  if (typeof r.nome !== "string" || r.nome.trim().length < 2) return "Nome troppo corto (min 2 caratteri)";
  if (r.nome.trim().length > MAX_NOME) return `Nome troppo lungo (max ${MAX_NOME} caratteri)`;
  if (typeof r.email !== "string") return "Indirizzo email non valido";
  if (r.email.trim().length > 254) return "Indirizzo email troppo lungo";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) return "Indirizzo email non valido";
  if (r.azienda !== undefined && r.azienda !== null && typeof r.azienda !== "string") return "Azienda non valida";
  if (typeof r.azienda === "string" && r.azienda.trim().length > 200) {
    return "Nome dell'azienda troppo lungo (max 200 caratteri)";
  }
  if (typeof r.progetto !== "string" || r.progetto.trim().length < 10) {
    return "Descrivi il progetto in almeno 10 caratteri";
  }
  if (r.progetto.length > 3000) return "Descrizione troppo lunga (max 3000 caratteri)";
  if ((r.progetto.match(/https?:\/\//gi) ?? []).length > 3) return "Troppi link nella descrizione (max 3)";
  return null;
}

export function validateDeveloperRequest(
  d: DeveloperRequest,
): { ok: true; domain: string } | { ok: false; error: string } {
  const fieldErr = validateContactFields(d);
  if (fieldErr) return { ok: false, error: fieldErr };
  if (typeof d.dominio !== "string" || typeof d.attributionUrl !== "string") {
    return { ok: false, error: "Indica il dominio del sito e la pagina dove mostri i dati" };
  }
  const domain = normalizeDomain(d.dominio);
  if (!domain) return { ok: false, error: "Dominio non valido (es. tuosito.it)" };
  const rawUrl = d.attributionUrl.trim();
  if (rawUrl.length > MAX_URL_LENGTH) return { ok: false, error: "Indirizzo della pagina troppo lungo" };
  let page: URL;
  try {
    page = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Indirizzo della pagina non valido (es. https://tuosito.it/prezzi-energia)" };
  }
  if (page.protocol !== "https:" && page.protocol !== "http:") {
    return { ok: false, error: "La pagina deve essere http o https" };
  }
  // hostMatchesDomain, non originAllowed: niente eccezione localhost/127.0.0.1,
  // altrimenti il link checker scaricherebbe indirizzi di loopback (SSRF).
  if (!hostMatchesDomain(page.host, domain)) {
    return { ok: false, error: `La pagina deve stare su ${domain}` };
  }
  // Stesse regole del link checker (porte standard, niente credenziali):
  // una pagina che non potremmo scaricare fallirebbe ogni verifica.
  if (!isCheckableUrl(page)) {
    return { ok: false, error: "La pagina deve essere raggiungibile sulle porte standard (80 o 443)" };
  }
  return { ok: true, domain };
}

const SITE = "https://energyindex.it";
const SENDER = process.env.RESEND_SENDER_EMAIL || "EIDX Pro <onboarding@resend.dev>";
const UNAVAILABLE = `Servizio temporaneamente non disponibile: riprova più tardi o scrivi a ${CONTACT_EMAIL}`;

async function send(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[api-keys/issue] RESEND_API_KEY non configurata");
    return false;
  }
  try {
    const res = await new Resend(apiKey).emails.send({ from: SENDER, to, subject, text, replyTo: CONTACT_EMAIL });
    if (res.error) console.error("[api-keys/issue] Resend:", res.error.message);
    return !res.error;
  } catch (e) {
    console.error("[api-keys/issue] Resend:", e);
    return false;
  }
}

export type StartResult =
  | { ok: true }
  /**
   * retry: errore del servizio (DB, email), non della richiesta: ha senso il
   * fallback manuale. capped: tetto orario globale raggiunto (probabile
   * ondata di bot), il lead non va salvato.
   */
  | { ok: false; error: string; retry?: boolean; capped?: true };

/** Crea la richiesta pending e manda il link di verifica (valido 24 ore). */
export async function startDeveloperRequest(d: DeveloperRequest, domain: string): Promise<StartResult> {
  const db = createServiceClient();
  if (!db) return { ok: false, error: UNAVAILABLE, retry: true };
  const email = d.email.trim().toLowerCase();
  const nome = sanitizeName(d.nome);
  const now = new Date();

  // Tetto globale: un'ondata di richieste (bot su indirizzi diversi) ferma il
  // self-service invece di far partire centinaia di email. Resta il fallback manuale.
  const { count: hourly, error: hourlyErr } = await db
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(now.getTime() - 3600_000).toISOString());
  if (hourlyErr) {
    console.error("[startDeveloperRequest] conteggio globale:", hourlyErr.message);
    return { ok: false, error: UNAVAILABLE, retry: true };
  }
  if ((hourly ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    console.warn("[startDeveloperRequest] tetto orario raggiunto");
    return { ok: false, error: UNAVAILABLE, retry: true, capped: true };
  }

  // Limite anti-abuso: poche richieste al giorno per indirizzo.
  const { count, error: countErr } = await db
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", new Date(now.getTime() - 24 * 3600_000).toISOString());
  if (countErr) {
    console.error("[startDeveloperRequest] conteggio:", countErr.message);
    return { ok: false, error: UNAVAILABLE, retry: true };
  }
  if ((count ?? 0) >= MAX_REQUESTS_PER_EMAIL_PER_DAY) {
    return { ok: false, error: `Troppe richieste per questo indirizzo: riprova domani o scrivi a ${CONTACT_EMAIL}` };
  }

  // Una chiave per email e dominio. Una richiesta pending scaduta non blocca.
  const { data: existing, error: dupErr } = await db
    .from("api_keys")
    .select("status, verify_expires_at")
    .eq("email", email)
    .eq("domain", domain)
    .in("status", ["pending", "active", "downgraded"]);
  if (dupErr) {
    console.error("[startDeveloperRequest] duplicati:", dupErr.message);
    return { ok: false, error: UNAVAILABLE, retry: true };
  }
  const rows = (existing ?? []) as { status: string; verify_expires_at: string | null }[];
  if (rows.some((r) => r.status !== "pending")) {
    return { ok: false, error: `Esiste già una chiave per questo dominio: scrivi a ${CONTACT_EMAIL}` };
  }
  if (rows.some((r) => r.verify_expires_at && new Date(r.verify_expires_at) > now)) {
    return {
      ok: false,
      error: "Hai già una richiesta in attesa per questo dominio: controlla la posta, il link vale 24 ore",
    };
  }

  const token = generateApiKey().slice(10); // 32 caratteri casuali, stesso generatore
  const { data: inserted, error } = await db
    .from("api_keys")
    .insert({
      email,
      nome,
      azienda: d.azienda?.trim() || null,
      progetto: d.progetto.trim(),
      domain,
      attribution_url: d.attributionUrl.trim(),
      verify_token_hash: await sha256Hex(token),
      verify_expires_at: new Date(now.getTime() + VERIFY_TTL_MS).toISOString(),
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error("[startDeveloperRequest] insert:", error?.message);
    return { ok: false, error: UNAVAILABLE, retry: true };
  }

  const sent = await send(
    email,
    "Conferma la tua chiave API Energy Index",
    [
      `Ciao ${nome},`,
      "",
      `per attivare la chiave Developer per ${domain} apri questo link entro 24 ore e premi "Attiva la chiave":`,
      `${SITE}/it/api/chiave/verifica?t=${token}`,
      "",
      'Ricorda: accanto ai dati va mostrato il link "Fonte: Energy Index" (https://energyindex.it).',
      "Lo verifichiamo ogni settimana sulla pagina che ci hai indicato:",
      d.attributionUrl.trim(),
      "",
      "Se non hai richiesto tu la chiave, ignora questa email.",
    ].join("\n"),
  );
  if (!sent) {
    // Senza email il token e' inutilizzabile: togliamo la riga, cosi' la
    // richiesta si puo' ripetere subito invece di restare bloccata 24 ore.
    const { error: delErr } = await db.from("api_keys").delete().eq("id", inserted.id).eq("status", "pending");
    if (delErr) console.error("[startDeveloperRequest] rollback:", delErr.message);
    return { ok: false, error: "Invio dell'email non riuscito", retry: true };
  }
  return { ok: true };
}

export type ActivateResult =
  | { ok: true; key: string; domain: string; attributionUrl: string; linkFound: boolean }
  | { ok: false; error: string };

/**
 * 23505 su prefix o key_hash (vincoli UNIQUE di colonna, nomi di default di
 * Postgres): la chiave generata collide con una esistente, non e' un
 * duplicato email/dominio (uq_api_keys_live_email_domain).
 */
function isKeyCollision(error: { code?: string; message?: string; details?: string } | null): boolean {
  if (error?.code !== "23505") return false;
  return /api_keys_(prefix|key_hash)_key/.test(`${error.message ?? ""} ${error.details ?? ""}`);
}

/** Attiva la richiesta e restituisce la chiave in chiaro (unica volta). */
export async function activateDeveloperKey(token: string): Promise<ActivateResult> {
  if (!isVerifyToken(token)) return { ok: false, error: "Link non valido o già usato" };
  const db = createServiceClient();
  if (!db) return { ok: false, error: UNAVAILABLE };
  const tokenHash = await sha256Hex(token);
  const { data: row, error: selErr } = await db
    .from("api_keys")
    .select("id, email, nome, domain, attribution_url, status, verify_expires_at")
    .eq("verify_token_hash", tokenHash)
    .maybeSingle();
  if (selErr) {
    console.error("[activateDeveloperKey] select:", selErr.message);
    return { ok: false, error: UNAVAILABLE };
  }
  if (!row || row.status !== "pending") return { ok: false, error: "Link non valido o già usato" };
  if (!row.verify_expires_at || new Date(row.verify_expires_at) < new Date()) {
    return { ok: false, error: "Link scaduto: ripeti la richiesta dalla pagina API" };
  }

  // Budget breve: l'utente aspetta davanti al pulsante. La verifica
  // settimanale ricontrolla comunque con il timeout pieno.
  const linkFound = await fetchHasLink(row.attribution_url, fetch, 5_000);
  const nowIso = new Date().toISOString();
  // Il filtro su token e stato rende l'attivazione atomica: con due clic
  // contemporanei solo uno aggiorna la riga, l'altro non vede la sua chiave.
  const activate = async (k: string) =>
    db
      .from("api_keys")
      .update({
        prefix: keyDisplayPrefix(k),
        key_hash: await sha256Hex(k),
        status: "active",
        activated_at: nowIso,
        verify_token_hash: null,
        link_checked_at: nowIso,
        link_ok: linkFound,
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .eq("verify_token_hash", tokenHash)
      .select("id");

  let key = generateApiKey();
  let { data: updated, error } = await activate(key);
  if (isKeyCollision(error)) {
    // Il prefisso visibile ha solo 4 caratteri casuali: una collisione con
    // una chiave esistente e' rara ma possibile. Si rigenera una volta.
    key = generateApiKey();
    ({ data: updated, error } = await activate(key));
  }
  if (error?.code === "23505" && !isKeyCollision(error)) {
    // Indice unico su (lower(email), domain) per le chiavi attive o declassate.
    return { ok: false, error: "Esiste già una chiave attiva per questo dominio con questo indirizzo." };
  }
  if (error) {
    console.error("[activateDeveloperKey] update:", error.message);
    return { ok: false, error: "Attivazione non riuscita: riprova tra qualche minuto" };
  }
  if (!updated || updated.length === 0) return { ok: false, error: "Link non valido o già usato" };

  await send(
    row.email,
    "La tua chiave API Energy Index",
    [
      `Ciao ${sanitizeName(String(row.nome ?? ""))},`,
      "",
      `ecco la tua chiave Developer per ${row.domain}:`,
      key,
      "",
      "Usala nell'header: Authorization: Bearer <chiave>",
      "L'API la riconosce entro un minuto dall'attivazione.",
      `Documentazione: ${SITE}/it/api/docs`,
      "",
      linkFound
        ? "Abbiamo trovato il link di attribuzione sulla tua pagina: grazie!"
        : `Non abbiamo ancora trovato il link a energyindex.it su ${row.attribution_url}: aggiungilo prima della verifica settimanale.`,
      "",
      "Conserva la chiave: non la mostreremo di nuovo.",
    ].join("\n"),
  );
  return { ok: true, key, domain: row.domain, attributionUrl: row.attribution_url, linkFound };
}
