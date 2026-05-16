"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

type Role = "fornitore" | "broker" | "pmi" | "consulente" | "altro";

const ROLE_LABELS: Record<Role, string> = {
  fornitore: "Fornitore di energia",
  broker: "Broker / Trader",
  pmi: "PMI energivora",
  consulente: "Consulente energy",
  altro: "Altro",
};

/**
 * Form di pre-registrazione EIDX Pro. NO backend: apre un mailto con
 * body precompilato verso commerciale@deagroup.biz e registra l'evento
 * lead_signup su Plausible (con role + size per segmentation).
 *
 * Trade-off vs. Supabase + Server Action:
 *  - Mailto = zero infra, niente DB schema, niente moderazione spam,
 *    niente GDPR/consent storage. Il lead arriva direttamente in inbox.
 *  - Quando i volumi superano ~10/giorno o serve auto-replies, migrare
 *    a Server Action + tabella eidx_pro_leads + email transactional.
 */
export function LeadCaptureForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [submitted, setSubmitted] = useState(false);

  const isValid = email.includes("@") && email.includes(".") && role !== "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    trackEvent("eidx_pro_lead_signup", { role });

    const subject = encodeURIComponent("EIDX Pro — interesse al lancio");
    const body = encodeURIComponent(
      `Ciao,\n\nSono interessato/a a EIDX Pro al lancio.\n\nEmail: ${email}\nRuolo: ${ROLE_LABELS[role as Role]}\n\nAvvisatemi quando il prodotto sara' disponibile.\n\nGrazie.`,
    );
    window.location.href = `mailto:commerciale@deagroup.biz?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-2">
        <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
          Grazie! Si e&apos; aperto il tuo client email.
        </h3>
        <p className="text-sm text-muted-foreground">
          Invia il messaggio per completare la pre-registrazione. Ti contatteremo prima del lancio.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="lead-email" className="block text-sm font-medium">
            Email aziendale
          </label>
          <input
            id="lead-email"
            type="email"
            required
            placeholder="nome@azienda.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="lead-role" className="block text-sm font-medium">
            Sei un...
          </label>
          <select
            id="lead-role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="">Seleziona...</option>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={!isValid}
        className="w-full rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.01] hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        Avvisami al lancio
      </button>

      <p className="text-xs text-muted-foreground">
        Niente spam. Solo un&apos;email quando il prodotto sara&apos; disponibile (Q3 2026).
        Puoi cancellarti in qualsiasi momento.
      </p>
    </form>
  );
}
