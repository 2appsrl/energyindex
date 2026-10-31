"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { RefreshCw, ShieldOff } from "lucide-react";
import { recheckApiKeyLink, revokeApiKey, type AdminKeyResult } from "@/app/actions/admin-api-keys";
import { cn } from "@/lib/utils";

/** Pulsanti Ricontrolla e Revoca di una chiave; la revoca chiede conferma. */
export function ApiKeyActions({ id, domain, canRecheck, canRevoke }: {
  id: string;
  domain: string;
  canRecheck: boolean;
  canRevoke: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminKeyResult | null>(null);

  const run = (fn: (id: string) => Promise<AdminKeyResult>) =>
    start(async () => {
      try {
        setResult(await fn(id));
      } catch (e) {
        // Sessione scaduta: requireAdmin fa redirect al login, Next deve gestirlo.
        unstable_rethrow(e);
        setResult({ ok: false, error: "Operazione non riuscita." });
      }
    });

  const btn =
    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50";

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {canRecheck && (
          <button type="button" className={btn} disabled={pending} onClick={() => run(recheckApiKeyLink)}>
            <RefreshCw className={cn("size-3.5", pending && "animate-spin")} /> Ricontrolla
          </button>
        )}
        {canRevoke && (
          <button
            type="button"
            className={cn(btn, "text-rose-700 dark:text-rose-400")}
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Revocare la chiave di ${domain}? Smette di funzionare entro un minuto.`)) run(revokeApiKey);
            }}
          >
            <ShieldOff className="size-3.5" /> Revoca
          </button>
        )}
      </div>
      {result && (
        <p
          role="status"
          className={cn("text-[11px]", result.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}
        >
          {result.ok ? result.message : result.error}
        </p>
      )}
    </div>
  );
}
