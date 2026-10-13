"use server";

/**
 * Server Action per le richieste di API key dal form di /it/api.
 *
 * In attesa del rilascio automatico delle chiavi, la richiesta arriva via
 * Resend a pro@energyindex.pro e la chiave viene emessa a mano. Stesso
 * setup e stesso fallback mailto di send-contact-email.ts.
 */

import { Resend } from "resend";
import { saveLead } from "@/lib/admin/leads";

export type ApiKeyPlan = "developer" | "api" | "pro" | "enterprise";

export interface ApiKeyRequestData {
  nome: string;
  email: string;
  azienda?: string;
  piano: ApiKeyPlan;
  progetto: string;
}

export type ApiKeyRequestResult =
  | { ok: true }
  | { ok: false; error: string; fallbackMailto?: string };

const RECIPIENT = "pro@energyindex.pro";
const SENDER = process.env.RESEND_SENDER_EMAIL || "EIDX Pro <onboarding@resend.dev>";

const PLAN_LABELS: Record<ApiKeyPlan, string> = {
  developer: "Developer (gratis)",
  api: "API (99 €/mese)",
  pro: "Pro (499 €/mese)",
  enterprise: "Enterprise",
};

function validate(d: ApiKeyRequestData): string | null {
  if (!d.nome || d.nome.trim().length < 2) return "Nome troppo corto (min 2 caratteri)";
  if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return "Indirizzo email non valido";
  if (!(d.piano in PLAN_LABELS)) return "Piano non valido";
  if (!d.progetto || d.progetto.trim().length < 10) return "Descrivi il progetto in almeno 10 caratteri";
  if (d.progetto.length > 3000) return "Descrizione troppo lunga (max 3000 caratteri)";
  if ((d.progetto.match(/https?:\/\//gi) ?? []).length > 3) return "Troppi link nella descrizione (max 3)";
  return null;
}

function mailtoFallback(d: ApiKeyRequestData): string {
  const subject = encodeURIComponent(`Richiesta API key — ${PLAN_LABELS[d.piano] ?? d.piano}`);
  const body = encodeURIComponent(
    `Nome: ${d.nome}\nEmail: ${d.email}\nAzienda: ${d.azienda || "(non indicata)"}\nPiano: ${PLAN_LABELS[d.piano] ?? d.piano}\n\nProgetto:\n${d.progetto}`,
  );
  return `mailto:${RECIPIENT}?subject=${subject}&body=${body}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function requestApiKey(d: ApiKeyRequestData): Promise<ApiKeyRequestResult> {
  const err = validate(d);
  if (err) return { ok: false, error: err };

  await saveLead({
    source: "api_key",
    nome: d.nome,
    email: d.email,
    azienda: d.azienda,
    piano: d.piano,
    messaggio: d.progetto,
  });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[requestApiKey] RESEND_API_KEY non configurata. Fallback mailto.");
    return {
      ok: false,
      error: "Servizio email non configurato lato server. Usa il link per inviare la richiesta dal tuo client email.",
      fallbackMailto: mailtoFallback(d),
    };
  }

  const plan = PLAN_LABELS[d.piano];
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #4c1d95; color: white; padding: 20px;">
        <h2 style="margin: 0; font-size: 18px;">Energy Index API &middot; Richiesta chiave</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.8;">Inviato dal form /it/api</p>
      </div>
      <div style="padding: 20px; background: #f8f8f7;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; font-weight: 600; width: 120px;">Piano</td><td>${escapeHtml(plan)}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Nome</td><td>${escapeHtml(d.nome)}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Email</td><td><a href="mailto:${escapeHtml(d.email)}">${escapeHtml(d.email)}</a></td></tr>
          <tr><td style="padding: 6px 0; font-weight: 600;">Azienda</td><td>${escapeHtml(d.azienda || "(non indicata)")}</td></tr>
        </table>
        <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e5e5;" />
        <p style="font-weight: 600; font-size: 14px; margin: 0 0 8px 0;">Progetto</p>
        <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e5e5; white-space: pre-wrap; font-size: 14px; line-height: 1.5;">${escapeHtml(d.progetto)}</div>
      </div>
    </div>
  `;
  const text = [
    "Energy Index API · Richiesta chiave",
    `Piano:    ${plan}`,
    `Nome:     ${d.nome}`,
    `Email:    ${d.email}`,
    `Azienda:  ${d.azienda || "(non indicata)"}`,
    "",
    "Progetto:",
    d.progetto,
  ].join("\n");

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: SENDER,
      to: RECIPIENT,
      replyTo: d.email,
      subject: `[API key] ${plan} — ${d.nome}`,
      html,
      text,
    });
    if (result.error) {
      console.error("[requestApiKey] Resend error:", result.error);
      return { ok: false, error: `Errore invio: ${result.error.message}`, fallbackMailto: mailtoFallback(d) };
    }
    return { ok: true };
  } catch (e) {
    console.error("[requestApiKey] Exception:", e);
    return {
      ok: false,
      error: `Errore di rete: ${e instanceof Error ? e.message : "sconosciuto"}`,
      fallbackMailto: mailtoFallback(d),
    };
  }
}
