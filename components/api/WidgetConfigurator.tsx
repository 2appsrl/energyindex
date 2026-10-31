"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Moon, Sun } from "lucide-react";
import { WIDGET_VARIANTS, type WidgetVariant } from "@/lib/widget/core";
import { WIDGET_VARIANT_ORDER, buildSnippet, type WidgetTheme } from "@/lib/widget/snippet";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const VARIANT_HINT: Record<WidgetVariant, string> = {
  "indice-luce": "Mediana delle offerte luce a prezzo fisso e variabile",
  "indice-gas": "Mediana delle offerte gas a prezzo fisso e variabile",
  pun: "Media giornaliera del PUN (dati GME)",
  psv: "Prezzo del giorno gas al PSV (dati GME)",
};

/** Lo snippet senza il tag <script>: nell'anteprima lo script si carica a parte. */
const withoutScript = (snippet: string) => snippet.replace(/\n<script[\s\S]*$/, "");

/**
 * Configuratore del widget: variante, tema, anteprima dal vivo e snippet da
 * copiare. widget.js monta ogni .eidx-widget una sola volta (flag
 * data-eidx-ready) e solo dopo "load": a ogni cambio il contenitore
 * dell'anteprima si rimonta con una key nuova e si inietta di nuovo lo
 * script (idempotente sulle radici gia' montate), cosi' la radice nuova
 * viene disegnata.
 */
export function WidgetConfigurator() {
  const [variant, setVariant] = useState<WidgetVariant>("indice-luce");
  const [theme, setTheme] = useState<WidgetTheme>("light");
  const [copied, setCopied] = useState(false);
  const loads = useRef(0);
  const snippet = buildSnippet(variant, theme);

  useEffect(() => {
    const s = document.createElement("script");
    s.src = `/widget.js?v=${++loads.current}`;
    s.async = true;
    document.body.appendChild(s);
    return () => s.remove();
  }, [variant, theme]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      trackEvent("widget_snippet_copy", { variant });
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard non disponibile (iframe, permessi): nessun feedback
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="min-w-0 space-y-5 rounded-2xl border bg-card p-6">
        <div className="space-y-2">
          <label htmlFor="eidx-variant" className="text-sm font-bold">
            Dato da mostrare
          </label>
          <select
            id="eidx-variant"
            value={variant}
            onChange={(e) => setVariant(e.target.value as WidgetVariant)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-semibold"
          >
            {WIDGET_VARIANT_ORDER.map((v) => (
              <option key={v} value={v}>
                {WIDGET_VARIANTS[v].label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{VARIANT_HINT[variant]}</p>
        </div>

        <div className="space-y-2">
          <span id="eidx-theme" className="block text-sm font-bold">
            Tema
          </span>
          <div role="group" aria-labelledby="eidx-theme" className="inline-flex rounded-lg border p-1">
            {(
              [
                { id: "light", label: "Chiaro", icon: Sun },
                { id: "dark", label: "Scuro", icon: Moon },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={theme === id}
                onClick={() => setTheme(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  theme === id ? "bg-violet-600 text-white" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-bold">Anteprima</p>
          <div
            className={cn(
              "rounded-xl border p-5",
              theme === "dark" ? "bg-stone-900 text-stone-100 [&_a]:text-emerald-300" : "bg-white text-stone-900 [&_a]:text-emerald-700",
              "[&_.eidx-src]:mt-1 [&_.eidx-src]:text-xs [&_a]:underline [&_.eidx-widget>a]:mt-2 [&_.eidx-widget>a]:inline-block [&_.eidx-widget>a]:text-sm [&_.eidx-widget>a]:font-semibold",
            )}
          >
            <div
              key={`${variant}-${theme}`}
              className="max-w-xs"
              dangerouslySetInnerHTML={{ __html: withoutScript(snippet) }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            I link sotto il riquadro fanno parte dello snippet: puoi cambiarne lo stile, non toglierli.
          </p>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl bg-stone-950 ring-1 ring-white/10 shadow-xl self-start">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
          <span className="font-mono text-[11px] text-stone-400">snippet.html</span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold text-stone-100 transition-colors hover:bg-white/20"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            {copied ? "Copiato" : "Copia codice"}
          </button>
        </div>
        <pre className="overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-stone-100">
          <code>{snippet}</code>
        </pre>
      </div>
    </div>
  );
}
