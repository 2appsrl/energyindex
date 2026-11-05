/**
 * Tipi e helper puri della sezione Mail di /it/admin. Nessuna dipendenza da
 * server o SDK: li usano sia lo script di sincronizzazione sia i componenti.
 */

export const MAIL_CATEGORIES = [
  "api_dati",
  "commerciale_pro",
  "partnership",
  "supporto",
  "proposta_fornitore",
  "automatica",
  "spam",
  "altro",
] as const;
export type MailCategory = (typeof MAIL_CATEGORIES)[number];

export const MAIL_CATEGORY_LABELS: Record<MailCategory, string> = {
  api_dati: "API e dati",
  commerciale_pro: "Commerciale Pro",
  partnership: "Partnership",
  supporto: "Supporto",
  proposta_fornitore: "Proposte ricevute",
  automatica: "Automatiche",
  spam: "Spam",
  altro: "Altro",
};

export const MAIL_PRIORITIES = ["alta", "normale", "bassa"] as const;
export type MailPriority = (typeof MAIL_PRIORITIES)[number];

export const MAIL_STATUSES = ["nuova", "risposta", "archiviata"] as const;
export type MailStatus = (typeof MAIL_STATUSES)[number];

/** Riga della tabella inbound_emails. */
export interface InboundEmail {
  id: number;
  message_id: string;
  received_at: string;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  subject: string | null;
  body_text: string | null;
  attachment_names: string[];
  category: MailCategory | null;
  priority: MailPriority | null;
  summary: string | null;
  reply_subject: string | null;
  reply_draft: string | null;
  review_note: string | null;
  analyzed_at: string | null;
  analysis_attempts: number;
  analysis_error: string | null;
  status: MailStatus;
}

/** Nome dell'etl_runs che registra ogni sincronizzazione. */
export const MAIL_SYNC_SOURCE = "mail_pro";

/** Filtro della scheda Mail: una categoria, tutte, o quelle non ancora analizzate. */
export type MailFilter = MailCategory | "tutte" | "da_analizzare";

export function parseMailFilter(value: string | undefined): MailFilter {
  if (value === "da_analizzare") return value;
  return MAIL_CATEGORIES.find((c) => c === value) ?? "tutte";
}

/**
 * Le archiviate spariscono dalla scheda finche' non si chiedono esplicitamente.
 * Il conteggio per categoria guarda le stesse righe che poi si vedono.
 */
export function visibleEmails<T extends Pick<InboundEmail, "status">>(emails: T[], showArchived: boolean): T[] {
  return showArchived ? emails.filter((e) => e.status === "archiviata") : emails.filter((e) => e.status !== "archiviata");
}

export function filterEmails<T extends Pick<InboundEmail, "category">>(emails: T[], filter: MailFilter): T[] {
  if (filter === "tutte") return emails;
  if (filter === "da_analizzare") return emails.filter((e) => e.category === null);
  return emails.filter((e) => e.category === filter);
}

export function countByFilter<T extends Pick<InboundEmail, "category">>(emails: T[]): Record<MailFilter, number> {
  const counts = { tutte: emails.length, da_analizzare: 0 } as Record<MailFilter, number>;
  for (const c of MAIL_CATEGORIES) counts[c] = 0;
  for (const e of emails) counts[e.category ?? "da_analizzare"] += 1;
  return counts;
}

const EMAIL_RE = /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[^\s@<>"',;:]+$/;

/** Limite prudente: oltre questa lunghezza diversi client ignorano o tagliano il mailto. */
const MAILTO_MAX_LENGTH = 1800;

export interface MailtoResult {
  href: string;
  /** false se la bozza era troppo lunga: va incollata a mano. */
  includesBody: boolean;
}

/**
 * Link che apre il client di posta con la risposta gia' compilata. L'indirizzo
 * viene da un'email ricevuta: niente link se non e' un indirizzo valido, cosi'
 * non si possono iniettare destinatari o intestazioni nel mailto.
 */
export function buildReplyMailto(to: string | null, subject: string | null, body: string | null): MailtoResult | null {
  if (!to || !EMAIL_RE.test(to)) return null;
  const base = `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject ?? "")}`;
  const full = `${base}&body=${encodeURIComponent(body ?? "")}`;
  return full.length <= MAILTO_MAX_LENGTH ? { href: full, includesBody: true } : { href: base, includesBody: false };
}
