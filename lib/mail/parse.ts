import { createHash } from "node:crypto";
import { simpleParser, type AddressObject } from "mailparser";

/** Oltre questa lunghezza il testo viene tagliato, con un avviso visibile. */
export const MAX_BODY_CHARS = 30_000;
export const TRUNCATED_NOTICE = "\n\n[Messaggio tagliato: il testo completo è nella casella di posta]";

export interface ParsedEmail {
  message_id: string;
  received_at: string;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  subject: string | null;
  body_text: string | null;
  attachment_names: string[];
}

function firstAddress(field: AddressObject | AddressObject[] | undefined) {
  const list = Array.isArray(field) ? field : field ? [field] : [];
  for (const group of list) {
    for (const a of group.value) if (a.address) return a;
  }
  return null;
}

/** Postgres rifiuta il carattere NUL nei campi di testo. */
const clean = (s: string | undefined | null) => s?.replace(/\u0000/g, "").trim() || null;

/** Trasforma il sorgente RFC 822 di un messaggio nella riga da salvare. */
export async function parseRawEmail(source: Buffer | string, fallbackDate?: Date): Promise<ParsedEmail> {
  const mail = await simpleParser(source);
  const from = firstAddress(mail.from);
  const replyTo = firstAddress(mail.replyTo);
  const date = mail.date ?? fallbackDate ?? new Date();

  let body = clean(mail.text);
  if (body && body.length > MAX_BODY_CHARS) body = body.slice(0, MAX_BODY_CHARS) + TRUNCATED_NOTICE;

  const subject = clean(mail.subject);
  const fromEmail = from?.address?.toLowerCase() ?? null;
  // Message-ID assente (raro, ma succede con mittenti automatici): impronta
  // stabile, altrimenti lo stesso messaggio entrerebbe a ogni sincronizzazione.
  const messageId =
    clean(mail.messageId) ??
    `sintetico-${createHash("sha256").update(`${date.toISOString()}|${fromEmail}|${subject}|${body}`).digest("hex").slice(0, 32)}`;

  return {
    message_id: messageId,
    received_at: date.toISOString(),
    from_name: clean(from?.name),
    from_email: fromEmail,
    reply_to: replyTo?.address?.toLowerCase() ?? fromEmail,
    subject,
    body_text: body,
    attachment_names: mail.attachments.filter((a) => a.contentDisposition !== "inline").map((a) => a.filename ?? "(senza nome)"),
  };
}
