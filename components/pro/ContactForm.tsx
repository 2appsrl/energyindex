"use client";

import { useState, useTransition } from "react";
import { trackEvent } from "@/lib/analytics";
import { sendContactEmail } from "@/app/actions/send-contact-email";

/**
 * Form di contatto verso il team EIDX Pro.
 *
 * Pipeline reale (non piu' mailto):
 *  1. Submit chiama la Server Action sendContactEmail
 *  2. Server invia email via Resend verso pro@energyindex.pro
 *  3. Risposta: {ok: true} -> success state | {ok: false, fallbackMailto?} -> errore + fallback
 *
 * Setup richiesto:
 *  - RESEND_API_KEY nelle env vars (Netlify dashboard)
 *  - Dominio mittente verificato su Resend (o usa onboarding@resend.dev per test)
 *
 * Fallback: se il server ritorna fallbackMailto, mostriamo un link cliccabile
 * cosi' l'utente puo' comunque mandare il messaggio dal suo client email.
 */
export function ContactForm() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [azienda, setAzienda] = useState("");
  const [oggetto, setOggetto] = useState("Richiesta informazioni EIDX Pro");
  const [messaggio, setMessaggio] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | { type: "success" }
    | { type: "error"; message: string; mailtoFallback?: string }
    | null
  >(null);

  const isValid =
    nome.trim().length >= 2 &&
    email.includes("@") &&
    email.includes(".") &&
    messaggio.trim().length >= 10;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || pending) return;

    startTransition(async () => {
      trackEvent("eidx_pro_contact_submit", {
        oggetto: oggetto.slice(0, 60),
        hasAzienda: azienda.trim().length > 0 ? "yes" : "no",
      });

      const response = await sendContactEmail({
        nome: nome.trim(),
        email: email.trim(),
        azienda: azienda.trim() || undefined,
        oggetto,
        messaggio: messaggio.trim(),
      });

      if (response.ok) {
        setResult({ type: "success" });
        // Reset il form così se l'utente clicca "Invia un altro" è già pulito
        setMessaggio("");
      } else {
        setResult({
          type: "error",
          message: response.error,
          mailtoFallback: response.fallbackMailto,
        });
      }
    });
  }

  if (result?.type === "success") {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center space-y-3">
        <div className="text-3xl" aria-hidden>
          ✅
        </div>
        <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
          Messaggio inviato!
        </h3>
        <p className="text-sm text-muted-foreground">
          Grazie {nome.split(" ")[0]}, abbiamo ricevuto la tua richiesta. Ti risponderemo
          entro 2 giorni lavorativi all&apos;indirizzo{" "}
          <strong className="text-foreground font-mono text-xs">{email}</strong>.
        </p>
        <button
          type="button"
          onClick={() => {
            setResult(null);
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
            disabled={pending}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
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
            disabled={pending}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
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
            disabled={pending}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
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
            disabled={pending}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
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
          disabled={pending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-y disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground">
          Minimo 10 caratteri ({messaggio.trim().length}/10)
        </p>
      </div>

      {result?.type === "error" && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 space-y-2">
          <p>
            <strong>Errore invio:</strong> {result.message}
          </p>
          {result.mailtoFallback && (
            <p className="text-xs">
              In alternativa,{" "}
              <a href={result.mailtoFallback} className="underline font-semibold">
                inviaci direttamente dal tuo client email
              </a>
              .
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid || pending}
        className="w-full rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.01] hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        {pending ? "Invio in corso…" : "Invia messaggio →"}
      </button>

      <p className="text-xs text-muted-foreground">
        Il tuo messaggio verra&apos; inviato direttamente a{" "}
        <strong className="font-mono text-foreground">pro@energyindex.pro</strong>. Risposta
        garantita entro 2 giorni lavorativi.
      </p>
    </form>
  );
}
