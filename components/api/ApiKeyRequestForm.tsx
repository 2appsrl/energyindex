"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, KeyRound, Loader2, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { requestApiKey, type ApiKeyPlan } from "@/app/actions/request-api-key";

const PLANS: { id: ApiKeyPlan; name: string; price: string; accent: string }[] = [
  { id: "developer", name: "Developer", price: "Gratis", accent: "peer-checked:ring-sky-500 peer-checked:bg-sky-500/10" },
  { id: "api", name: "API", price: "99 €/mese", accent: "peer-checked:ring-violet-500 peer-checked:bg-violet-500/10" },
  { id: "pro", name: "Pro", price: "499 €/mese", accent: "peer-checked:ring-amber-500 peer-checked:bg-amber-500/10" },
  { id: "enterprise", name: "Enterprise", price: "Su misura", accent: "peer-checked:ring-stone-500 peer-checked:bg-stone-500/10" },
];

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

export function ApiKeyRequestForm() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [azienda, setAzienda] = useState("");
  const [piano, setPiano] = useState<ApiKeyPlan>("developer");
  const [progetto, setProgetto] = useState("");
  const [dominio, setDominio] = useState("");
  const [attributionUrl, setAttributionUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { type: "success"; mode: "verify" | "manual" } | { type: "error"; message: string; mailto?: string } | null
  >(null);

  const isDeveloper = piano === "developer";
  const isValid =
    nome.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    progetto.trim().length >= 10 &&
    (!isDeveloper || (dominio.trim().length >= 4 && /^https?:\/\/\S+$/i.test(attributionUrl.trim())));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || pending) return;
    startTransition(async () => {
      trackEvent("api_key_request", { piano });
      const res = await requestApiKey({
        nome: nome.trim(),
        email: email.trim(),
        azienda: azienda.trim() || undefined,
        piano,
        progetto: progetto.trim(),
        ...(isDeveloper ? { dominio: dominio.trim(), attributionUrl: attributionUrl.trim() } : {}),
      });
      setResult(
        res.ok ? { type: "success", mode: res.mode } : { type: "error", message: res.error, mailto: res.fallbackMailto },
      );
    });
  }

  if (result?.type === "success" && result.mode === "verify") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-3">
        <MailCheck className="mx-auto size-10 text-emerald-500" />
        <h3 className="text-xl font-bold">Controlla la posta</h3>
        <p className="text-sm text-muted-foreground">
          Ti abbiamo mandato all&apos;indirizzo <strong className="text-foreground">{email}</strong> il link per attivare
          la chiave (valido 24 ore). Dopo l&apos;attivazione l&apos;API riconosce la chiave entro un minuto.
        </p>
        <p className="text-xs text-muted-foreground">Non trovi l&apos;email? Controlla anche nello spam.</p>
      </div>
    );
  }

  if (result?.type === "success") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-3">
        <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
        <h3 className="text-xl font-bold">Richiesta ricevuta</h3>
        <p className="text-sm text-muted-foreground">
          Ti mandiamo la chiave all&apos;indirizzo <strong className="text-foreground">{email}</strong> entro 2 giorni lavorativi.
          Nel frattempo gli endpoint Open funzionano gia&apos; senza chiave.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Piano</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PLANS.map((p) => (
            <label key={p.id} className="cursor-pointer">
              <input
                type="radio"
                name="piano"
                value={p.id}
                checked={piano === p.id}
                onChange={() => setPiano(p.id)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "block rounded-xl border bg-background px-3 py-3 text-center ring-2 ring-transparent transition-all peer-focus-visible:ring-violet-500",
                  p.accent,
                )}
              >
                <span className="block text-sm font-bold">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.price}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="key-nome" className="block text-sm font-medium">Nome e cognome</label>
          <input id="key-nome" required value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} autoComplete="name" />
        </div>
        <div className="space-y-1">
          <label htmlFor="key-email" className="block text-sm font-medium">Email</label>
          <input
            id="key-email"
            type="email"
            required
            placeholder="nome@azienda.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            autoComplete="email"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="key-azienda" className="block text-sm font-medium">
          Azienda o progetto <span className="font-normal text-muted-foreground">(facoltativo)</span>
        </label>
        <input id="key-azienda" value={azienda} onChange={(e) => setAzienda(e.target.value)} className={inputClass} autoComplete="organization" />
      </div>
      {isDeveloper && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="key-dominio" className="block text-sm font-medium">Dominio del sito</label>
            <input
              id="key-dominio"
              required
              placeholder="tuosito.it"
              value={dominio}
              onChange={(e) => setDominio(e.target.value)}
              className={inputClass}
              autoComplete="url"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="key-attribuzione" className="block text-sm font-medium">Pagina dove mostri i dati</label>
            <input
              id="key-attribuzione"
              type="url"
              required
              placeholder="https://tuosito.it/prezzi-energia"
              value={attributionUrl}
              onChange={(e) => setAttributionUrl(e.target.value)}
              className={inputClass}
              aria-describedby="key-attribuzione-help"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <p id="key-attribuzione-help" className="text-xs text-muted-foreground sm:col-span-2">
            Lì deve comparire il link «Fonte: Energy Index». Lo verifichiamo ogni settimana.
          </p>
        </div>
      )}
      <div className="space-y-1">
        <label htmlFor="key-progetto" className="block text-sm font-medium">Cosa vuoi costruire?</label>
        <textarea
          id="key-progetto"
          required
          rows={4}
          placeholder="Es. widget PUN per il nostro blog, alert PSV sul canale Slack del team acquisti, app per spostare i consumi nelle ore meno care…"
          value={progetto}
          onChange={(e) => setProgetto(e.target.value)}
          className={inputClass}
        />
      </div>

      {result?.type === "error" && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
          <p className="text-rose-600 dark:text-rose-400">{result.message}</p>
          {result.mailto && (
            <a href={result.mailto} className="mt-1 inline-block font-semibold text-violet-600 underline dark:text-violet-400">
              Invia la richiesta dal tuo client email →
            </a>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid || pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition-all hover:bg-violet-500 hover:shadow-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        Richiedi la chiave
      </button>
      <p className="text-xs text-muted-foreground">
        Usiamo i tuoi dati solo per emettere la chiave e per comunicazioni sull&apos;API (modifiche, deprecazioni, manutenzioni).
      </p>
    </form>
  );
}
