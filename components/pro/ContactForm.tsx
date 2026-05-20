"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Form di contatto diretto verso il team EIDX Pro.
 * Stesso pattern del LeadCaptureForm (mailto, no backend) — il messaggio
 * pre-compilato viene aperto nel client email dell'utente verso
 * pro@energyindex.pro.
 *
 * Differenza dal LeadCaptureForm: cattura piu' campi (oggetto + messaggio
 * libero + azienda) ed e' pensato per richieste specifiche (demo, quote
 * enterprise, integrazioni, supporto tecnico, partnership).
 *
 * Quando i volumi superano ~10/giorno o serve auto-reply, migrare a
 * Server Action + tabella eidx_pro_contacts + email transactional.
 */
export function ContactForm() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [azienda, setAzienda] = useState("");
  const [oggetto, setOggetto] = useState("Richiesta informazioni EIDX Pro");
  const [messaggio, setMessaggio] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const isValid =
    nome.trim().length >= 2 &&
    email.includes("@") &&
    email.includes(".") &&
    messaggio.trim().length >= 10;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    trackEvent("eidx_pro_contact_submit", {
      oggetto: oggetto.slice(0, 60),
      hasAzienda: azienda.trim().length > 0 ? "yes" : "no",
    });

    const subject = encodeURIComponent(oggetto);
    const body = encodeURIComponent(
      `Nome: ${nome}\nEmail: ${email}\nAzienda: ${azienda || "(non indicata)"}\n\n` +
        `Messaggio:\n${messaggio}\n\n` +
        `---\nInviato dal form di contatto su energyindex.it/it/pro`,
    );
    window.location.href = `mailto:pro@energyindex.pro?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-2">
        <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
          Grazie! Si e&apos; aperto il tuo client email.
        </h3>
        <p className="text-sm text-muted-foreground">
          Invia il messaggio per completare la richiesta. Ti risponderemo entro 2 giorni
          lavorativi all&apos;indirizzo{" "}
          <a
            href="mailto:pro@energyindex.pro"
            className="font-mono text-primary hover:underline"
          >
            pro@energyindex.pro
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setMessaggio("");
          }}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Invia un altro messaggio
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="contact-nome" className="block text-sm font-medium">
            Nome e cognome <span className="text-rose-600">*</span>
          </label>
          <input
            id="contact-nome"
            type="text"
            required
            placeholder="Mario Rossi"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="contact-email" className="block text-sm font-medium">
            Email <span className="text-rose-600">*</span>
          </label>
          <input
            id="contact-email"
            type="email"
            required
            placeholder="nome@azienda.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="contact-azienda" className="block text-sm font-medium">
            Azienda
          </label>
          <input
            id="contact-azienda"
            type="text"
            placeholder="Es. Energia Verde S.p.A."
            value={azienda}
            onChange={(e) => setAzienda(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="contact-oggetto" className="block text-sm font-medium">
            Oggetto
          </label>
          <select
            id="contact-oggetto"
            value={oggetto}
            onChange={(e) => setOggetto(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option>Richiesta informazioni EIDX Pro</option>
            <option>Richiesta demo personalizzata</option>
            <option>Quote Enterprise / white-label</option>
            <option>Integrazione API / partnership</option>
            <option>Supporto tecnico</option>
            <option>Custom research / Modulo 03</option>
            <option>Altro</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="contact-messaggio" className="block text-sm font-medium">
          Messaggio <span className="text-rose-600">*</span>
        </label>
        <textarea
          id="contact-messaggio"
          required
          rows={5}
          placeholder="Raccontaci la tua esigenza: che tool ti interessano, che volumi gestisci, che integrazioni servono..."
          value={messaggio}
          onChange={(e) => setMessaggio(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-y"
        />
        <p className="text-xs text-muted-foreground">
          Minimo 10 caratteri ({messaggio.trim().length}/10)
        </p>
      </div>

      <button
        type="submit"
        disabled={!isValid}
        className="w-full rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.01] hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        Invia messaggio →
      </button>

      <p className="text-xs text-muted-foreground">
        Premendo &quot;Invia&quot; si aprira&apos; il tuo client email con il messaggio
        precompilato verso{" "}
        <strong className="font-mono text-foreground">pro@energyindex.pro</strong>. Risposta
        garantita entro 2 giorni lavorativi.
      </p>
    </form>
  );
}
