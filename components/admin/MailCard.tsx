"use client";

import { useRef, useState } from "react";
import { Check, Copy, Paperclip, Reply, TriangleAlert } from "lucide-react";
import { updateInboundEmail } from "@/app/actions/admin-mail";
import { fmtDateTime } from "@/components/admin/charts";
import {
  MAIL_CATEGORIES,
  MAIL_CATEGORY_LABELS,
  buildReplyMailto,
  type InboundEmail,
} from "@/lib/mail/types";
import { cn } from "@/lib/utils";

/** Una mail: sintesi, cosa controllare, bozza modificabile, messaggio originale. */
export function MailCard({ email }: { email: InboundEmail }) {
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState(email.reply_draft ?? "");
  const [copied, setCopied] = useState(false);

  const mailto = buildReplyMailto(email.reply_to, email.reply_subject ?? `Re: ${email.subject ?? ""}`, draft);
  const pending = !email.analyzed_at;

  const copy = async () => {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <form ref={form} action={updateInboundEmail} className="space-y-3">
        <input type="hidden" name="id" value={email.id} />

        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <h3 className="font-bold break-words">{email.subject ?? "(senza oggetto)"}</h3>
            <p className="text-xs text-muted-foreground break-words">
              {email.from_name ? `${email.from_name} · ` : ""}
              {email.reply_to ?? email.from_email ?? "mittente sconosciuto"} · {fmtDateTime(email.received_at)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {email.priority === "alta" && (
              <span className="rounded-full bg-rose-500/10 px-2 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                Priorità alta
              </span>
            )}
            {!pending && (
              <select
                name="category"
                defaultValue={email.category ?? "altro"}
                onChange={() => form.current?.requestSubmit()}
                aria-label="Categoria"
                className="rounded-md border-0 bg-violet-500/10 px-2 py-1 text-xs font-bold text-violet-700 ring-1 ring-border dark:text-violet-300"
              >
                {MAIL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {MAIL_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            )}
            <select
              name="status"
              defaultValue={email.status}
              onChange={() => form.current?.requestSubmit()}
              aria-label="Stato"
              className="rounded-md border-0 bg-muted px-2 py-1 text-xs font-bold ring-1 ring-border"
            >
              <option value="nuova">Da rispondere</option>
              <option value="risposta">Risposta inviata</option>
              <option value="archiviata">Archiviata</option>
            </select>
          </div>
        </header>

        {email.summary && <p className="text-sm">{email.summary}</p>}

        {pending && (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            {email.analysis_error
              ? `Analisi non riuscita (${email.analysis_attempts} tentativi): ${email.analysis_error}`
              : "In attesa di analisi: categoria e bozza arrivano alla prossima sincronizzazione."}
          </p>
        )}

        {email.review_note && (
          <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            <p>
              <strong>Prima di inviare:</strong> {email.review_note}
            </p>
          </div>
        )}

        {!pending && (
          <div className="space-y-2">
            <label htmlFor={`bozza-${email.id}`} className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Bozza di risposta
            </label>
            <textarea
              id={`bozza-${email.id}`}
              name="reply_draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                if (draft !== (email.reply_draft ?? "")) form.current?.requestSubmit();
              }}
              rows={Math.min(16, Math.max(4, draft.split("\n").length + 1))}
              placeholder="Nessuna risposta proposta per questo messaggio."
              className="w-full rounded-lg border border-input bg-background p-3 text-sm leading-relaxed"
            />
            <div className="flex flex-wrap items-center gap-2">
              {mailto && (
                <a
                  href={mailto.href}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-500"
                >
                  <Reply className="size-4" aria-hidden /> Rispondi
                </a>
              )}
              <button
                type="button"
                onClick={copy}
                disabled={!draft}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? "Copiata" : "Copia bozza"}
              </button>
              {mailto && !mailto.includesBody && (
                <span className="text-xs text-muted-foreground">Bozza troppo lunga per il link: copiala e incollala nella risposta.</span>
              )}
            </div>
          </div>
        )}
      </form>

      <details className="rounded-lg border bg-muted/30 p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Messaggio originale</summary>
        {email.attachment_names.length > 0 && (
          <p className={cn("mt-2 flex items-center gap-1.5 text-xs text-muted-foreground")}>
            <Paperclip className="size-3.5 shrink-0" aria-hidden /> {email.attachment_names.join(", ")}
          </p>
        )}
        <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed">{email.body_text ?? "(nessun testo)"}</p>
      </details>
    </article>
  );
}
