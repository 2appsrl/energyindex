"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { highlightJson } from "./code";

/**
 * Console "prova dal vivo": chiama davvero gli endpoint Open dal browser
 * (stessa origine, niente chiave) e mostra status, tempo e JSON.
 */

const LIVE_PATHS = [
  { path: "/api/v1/pun/today", label: "PUN di oggi" },
  { path: "/api/v1/psv/today", label: "PSV di oggi" },
  { path: "/api/v1/today", label: "Tutti gli indici" },
  { path: "/api/v1", label: "Indice dell'API" },
] as const;

type Result = { status: number; ms: number; body: string } | { error: string };

async function callEndpoint(target: string): Promise<Result> {
  const t0 = performance.now();
  try {
    const res = await fetch(target, { headers: { Accept: "application/json" } });
    const json = await res.json();
    return { status: res.status, ms: Math.round(performance.now() - t0), body: JSON.stringify(json, null, 2) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Errore di rete" };
  }
}

export function TryIt() {
  const [path, setPath] = useState<string>(LIVE_PATHS[0].path);
  // true al mount: la prima chiamata parte subito dall'effect qui sotto.
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Result | null>(null);

  const run = useCallback(async (target: string) => {
    setLoading(true);
    trackEvent("api_try_it", { path: target });
    setResult(await callEndpoint(target));
    setLoading(false);
  }, []);

  useEffect(() => {
    // Prima chiamata automatica: la sezione si apre gia' con una risposta vera.
    let cancelled = false;
    callEndpoint(LIVE_PATHS[0].path).then((r) => {
      if (cancelled) return;
      setResult(r);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl bg-stone-950 ring-1 ring-white/10 shadow-2xl">
      <div className="flex flex-wrap gap-2 border-b border-white/10 p-3">
        {LIVE_PATHS.map((p) => (
          <button
            key={p.path}
            type="button"
            onClick={() => {
              setPath(p.path);
              run(p.path);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              p.path === path
                ? "bg-emerald-500 text-stone-950"
                : "bg-white/5 text-stone-300 hover:bg-white/10",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="rounded-md bg-sky-600 px-2 py-0.5 font-mono text-[11px] font-black text-white">GET</span>
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-stone-200">
          https://energyindex.it{path}
        </code>
        <button
          type="button"
          onClick={() => run(path)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-bold text-stone-950 hover:bg-emerald-400 disabled:opacity-60 transition-colors"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          Invia
        </button>
      </div>

      <div className="flex items-center gap-3 px-4 pt-3 text-[11px] font-mono">
        {result && "status" in result && (
          <>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-bold",
                result.status < 300 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300",
              )}
            >
              {result.status}
            </span>
            <span className="text-stone-400">{result.ms} ms</span>
            <span className="text-stone-500">application/json · CORS *</span>
          </>
        )}
        {result && "error" in result && <span className="text-rose-300">{result.error}</span>}
      </div>

      <pre className="h-80 overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-stone-100">
        <code>
          {result && "body" in result
            ? highlightJson(result.body)
            : loading
              ? "Chiamata in corso…"
              : ""}
        </code>
      </pre>
    </div>
  );
}
