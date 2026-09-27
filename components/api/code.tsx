"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

/**
 * Blocchi di codice della sezione API: sfondo scuro fisso (anche in tema
 * chiaro) per il feel "terminale", pulsante copia, evidenziazione JSON
 * minimale senza dipendenze.
 */

const TOKEN_RE =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

/** Colora chiavi, stringhe, numeri e letterali di un testo JSON. */
export function highlightJson(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of src.matchAll(TOKEN_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(src.slice(last, i));
    if (m[1] && m[2]) {
      out.push(<span key={key++} className="text-sky-300">{m[1]}</span>, m[2]);
    } else if (m[1]) {
      out.push(<span key={key++} className="text-emerald-300">{m[1]}</span>);
    } else if (m[3]) {
      out.push(<span key={key++} className="text-violet-300">{m[3]}</span>);
    } else {
      out.push(<span key={key++} className="text-amber-300">{m[4]}</span>);
    }
    last = i + m[0].length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          trackEvent("api_code_copy", { label: label ?? "code" });
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // clipboard non disponibile (iframe, permessi): nessun feedback
        }
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-stone-300 hover:bg-white/10 hover:text-white transition-colors"
      aria-label="Copia il codice"
    >
      {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
      {copied ? "Copiato" : "Copia"}
    </button>
  );
}

export function CodeBlock({
  code,
  title,
  json = false,
  className,
  maxHeight,
}: {
  code: string;
  title?: string;
  json?: boolean;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl bg-stone-950 ring-1 ring-white/10 shadow-xl", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span aria-hidden className="flex gap-1">
            <span className="size-2.5 rounded-full bg-rose-400/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-emerald-400/80" />
          </span>
          {title && <span className="font-mono text-[11px] text-stone-400">{title}</span>}
        </div>
        <CopyButton text={code} label={title} />
      </div>
      <pre
        className="overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-stone-100"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code>{json ? highlightJson(code) : code}</code>
      </pre>
    </div>
  );
}

export function CodeTabs({
  tabs,
  className,
}: {
  tabs: { id: string; label: string; code: string }[];
  className?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;
  return (
    <div className={cn("overflow-hidden rounded-xl bg-stone-950 ring-1 ring-white/10 shadow-xl", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2">
        <div role="tablist" className="flex overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={t.id === current.id}
              onClick={() => setActive(t.id)}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition-colors",
                t.id === current.id
                  ? "border-violet-400 text-white"
                  : "border-transparent text-stone-400 hover:text-stone-200",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <CopyButton text={current.code} label={current.label} />
      </div>
      <pre className="overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-stone-100">
        <code>{current.code}</code>
      </pre>
    </div>
  );
}
