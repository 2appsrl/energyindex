"use server";

/**
 * Server Action per invio email transactional dal form Contatti di /it/pro.
 *
 * Pipeline:
 *  1. Client invoca questa action con i dati del form
 *  2. Server valida i campi (server-side, non solo client-side)
 *  3. Invia email via Resend (https://resend.com) verso pro@energyindex.pro
 *  4. Ritorna { ok, error? } al client per UI feedback
 *
 * Setup richiesto:
 *  - npm install resend (gia' fatto)
 *  - Variabile d'ambiente RESEND_API_KEY (Netlify dashboard -> Build & deploy -> Environment)
 *  - Dominio mittente verificato su Resend (o usa onboarding@resend.dev come fallback test)
 *
 * Free tier Resend: 3.000 email/mese, 100/giorno. Sufficiente per volumi early.
 */

import { Resend } from "resend";

// ============================================================
// TYPES (esportati per ContactForm)
// ============================================================

export interface ContactFormData {
  nome: string;
  email: string;
  azienda?: string;
  oggetto: string;
  messaggio: string;
}

export type SendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string; fallbackMailto?: string };

// ============================================================
// CONSTANTS
// ============================================================

const RECIPIENT = "pro@energyindex.pro";
/**
 * Mittente — DEVE essere un dominio verificato su Resend.
 * Per il test iniziale si puo' usare "onboarding@resend.dev" (no domain
 * verification needed, ma con limiti severi). In produzione: cambiare a
 * un indirizzo del dominio verificato (es. noreply@energyindex.it).
 */
const SENDER =
  process.env.RESEND_SENDER_EMAIL || "EIDX Pro <onboarding@resend.dev>";

// ============================================================
// VALIDATION (server-side, replica del client per sicurezza)
// ============================================================

function validate(data: ContactFormData): string | null {
  if (!data.nome || data.nome.trim().length < 2) {
    return "Nome troppo corto (min 2 caratteri)";
  }
  if (!data.email || !data.email.includes("@") || !data.email.includes(".")) {
    return "Indirizzo email non valido";
  }
  if (!data.messaggio || data.messaggio.trim().length < 10) {
    return "Messaggio troppo corto (min 10 caratteri)";
  }
  if (data.messaggio.length > 5000) {
    return "Messaggio troppo lungo (max 5000 caratteri)";
  }
  // Anti-spam basico: blocca URL multipli o pattern sospetti
  const urlCount = (data.messaggio.match(/https?:\/\//gi) ?? []).length;
  if (urlCount > 3) {
    return "Troppi link nel messaggio (max 3)";
  }
  return null;
}

// ============================================================
// MAILTO FALLBACK (se Resend non configurato)
// ============================================================

function buildMailtoFallback(data: ContactFormData): string {
  const subject = encodeURIComponent(data.oggetto);
  const body = encodeURIComponent(
    `Nome: ${data.nome}\nEmail: ${data.email}\nAzienda: ${data.azienda || "(non indicata)"}\n\nMessaggio:\n${data.messaggio}`,
  );
  return `mailto:${RECIPIENT}?subject=${subject}&body=${body}`;
}

// ============================================================
// ENTRY POINT
// ============================================================

export async function sendContactEmail(data: ContactFormData): Promise<SendResult> {
  // Validazione server-side
  const validationError = validate(data);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  // Check API key configurata
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Service non configurato — ritorna fallback mailto per UX graceful
    console.warn("[sendContactEmail] RESEND_API_KEY non configurata. Fallback mailto.");
    return {
      ok: false,
      error:
        "Servizio email non configurato lato server. Usa il link per inviare dal tuo client email.",
      fallbackMailto: buildMailtoFallback(data),
    };
  }

  const resend = new Resend(apiKey);

  // Componi email
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0a3d2e; color: white; padding: 20px;">
        <h2 style="margin: 0; font-size: 18px;">EIDX Pro &middot; Nuovo contatto</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">Inviato dal form /it/pro</p>
      </div>
      <div style="padding: 20px; background: #f8f8f7;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; font-weight: 600; width: 120px;">Nome</td><td>${escapeHtml(data.nome)}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Email</td><td><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Azienda</td><td>${escapeHtml(data.azienda || "(non indicata)")}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Oggetto</td><td>${escapeHtml(data.oggetto)}</td></tr>
        </table>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e5e5;" />
        <p style="font-weight: 600; font-size: 14px; margin: 0 0 8px 0;">Messaggio</p>
        <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e5e5; white-space: pre-wrap; font-size: 14px; line-height: 1.5;">${escapeHtml(data.messaggio)}</div>
      </div>
      <div style="padding: 12px 20px; font-size: 11px; color: #888; border-top: 1px solid #e5e5e5;">
        Form di contatto di EIDX Pro &middot; ${new Date().toLocaleString("it-IT")} &middot; Reply-to abilitato sul mittente
      </div>
    </div>
  `;

  const text = [
    "EIDX Pro · Nuovo contatto",
    "─".repeat(40),
    `Nome:     ${data.nome}`,
    `Email:    ${data.email}`,
    `Azienda:  ${data.azienda || "(non indicata)"}`,
    `Oggetto:  ${data.oggetto}`,
    "─".repeat(40),
    "Messaggio:",
    data.messaggio,
    "─".repeat(40),
    `Inviato il ${new Date().toLocaleString("it-IT")} dal form /it/pro`,
  ].join("\n");

  try {
    const result = await resend.emails.send({
      from: SENDER,
      to: RECIPIENT,
      replyTo: data.email,
      subject: `[EIDX Pro] ${data.oggetto} — ${data.nome}`,
      html,
      text,
    });

    if (result.error) {
      console.error("[sendContactEmail] Resend error:", result.error);
      return {
        ok: false,
        error: `Errore invio: ${result.error.message}`,
        fallbackMailto: buildMailtoFallback(data),
      };
    }

    return { ok: true, messageId: result.data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("[sendContactEmail] Exception:", err);
    return {
      ok: false,
      error: `Errore di rete: ${message}`,
      fallbackMailto: buildMailtoFallback(data),
    };
  }
}

// ============================================================
// HELPERS
// ============================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
