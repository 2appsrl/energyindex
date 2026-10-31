"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { activateApiKey, type ActivateState } from "@/app/actions/activate-api-key";
import { CodeBlock } from "@/components/api/code";

const ATTRIBUTION_SNIPPET = '<a href="https://energyindex.it">Fonte: Energy Index</a>';

export function ActivateKeyForm({ hasToken }: { hasToken: boolean }) {
  const [state, formAction, pending] = useActionState<ActivateState, FormData>(activateApiKey, null);

  if (state?.ok) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
          <p>
            Chiave attiva per <strong>{state.domain}</strong>. L&apos;API la riconosce entro un minuto.
          </p>
        </div>
        <CodeBlock code={state.key} title="La tua chiave" />
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          Non la mostreremo di nuovo, l&apos;abbiamo mandata anche per email. Usala nell&apos;header{" "}
          <code className="font-mono text-xs">Authorization: Bearer &lt;chiave&gt;</code>.
        </p>
        {state.linkFound ? (
          <p className="text-sm text-muted-foreground">
            Abbiamo trovato il link di attribuzione su {state.attributionUrl}: grazie!
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <p>
                Non abbiamo ancora trovato il link a energyindex.it su{" "}
                <span className="break-all font-medium">{state.attributionUrl}</span>. Aggiungilo accanto ai dati
                prima della verifica settimanale: dopo due verifiche senza link la chiave viene declassata.
              </p>
            </div>
            <CodeBlock code={ATTRIBUTION_SNIPPET} title="Snippet di attribuzione" />
          </div>
        )}
        <Link
          href="/it/api/docs"
          className="inline-block text-sm font-semibold text-violet-600 underline dark:text-violet-400"
        >
          Vai alla documentazione →
        </Link>
      </div>
    );
  }

  if (!hasToken && !state) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-rose-600 dark:text-rose-400">
          Link incompleto o già usato: apri per intero il link che ti abbiamo mandato per email.
        </p>
        <p className="text-muted-foreground">
          Se il link è scaduto,{" "}
          <Link href="/it/api#chiave" className="font-semibold text-violet-600 underline dark:text-violet-400">
            ripeti la richiesta
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Premi il pulsante per confermare l&apos;indirizzo email e generare la chiave. La vedrai una sola volta in
        questa pagina e la riceverai anche per email. Dopo l&apos;attivazione l&apos;API la riconosce entro un minuto.
      </p>
      {state && !state.ok && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm" role="alert">
          <p className="text-rose-600 dark:text-rose-400">{state.error}</p>
          <Link href="/it/api#chiave" className="mt-1 inline-block font-semibold text-violet-600 underline dark:text-violet-400">
            Ripeti la richiesta →
          </Link>
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        Attiva la chiave
      </button>
    </form>
  );
}
