"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, Lock, Code2, Trash2, Plus, Send, Copy, Check } from "lucide-react";
import {
  type AlertConfig,
  type AlertAsset,
  type AlertCondition,
  type AlertDestination,
  ASSET_LABELS,
  CONDITION_LABELS,
  DESTINATION_LABELS,
  LOCKED_DESTINATIONS,
} from "@/lib/pro/alert-types";

const NUM2 = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const STORAGE_KEY = "eidx_pro_alerts_v1";
const DEMO_MAX_ALERTS = 1;
const DEMO_API_KEY = "EIDX_DEMO_a3f9d2e1c8b4d7f0";

export interface AlertApiViewProps {
  /** Spot corrente per mostrare distanza dalla soglia */
  spot: { pun: number; psv: number; ttf: number; spark: number };
}

export function AlertApiView({ spot }: AlertApiViewProps) {
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Form state
  const [asset, setAsset] = useState<AlertAsset>("pun");
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [threshold, setThreshold] = useState<string>("130");

  // Hydration: carica alert da localStorage. SSR-safe — il setState e' necessario
  // per leggere dal browser dopo l'idratazione; React 19 lint rule e' un falso
  // positivo per questo pattern.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AlertConfig[];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Array.isArray(parsed)) setAlerts(parsed);
      }
    } catch {
      /* ignore corrupted storage */
    }
    setLoaded(true);
  }, []);

  // Persist su ogni cambio
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch {
      /* quota exceeded */
    }
  }, [alerts, loaded]);

  function addAlert() {
    const value = Number.parseFloat(threshold);
    if (!Number.isFinite(value) || value <= 0) return;
    const newAlert: AlertConfig = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      asset,
      condition,
      thresholdEurPerMwh: value,
      destination: "email",
      createdAt: new Date().toISOString(),
      active: true,
    };
    setAlerts((prev) => [...prev, newAlert]);
  }

  function removeAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  const canAddMore = alerts.length < DEMO_MAX_ALERTS;

  return (
    <div className="space-y-6">
      {/* DEMO BANNER */}
      <div className="rounded-2xl border border-amber-300/40 bg-amber-50/60 p-4 flex flex-wrap items-center gap-3 text-sm">
        <BellRing className="h-5 w-5 text-amber-700 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-900">
            Demo: max {DEMO_MAX_ALERTS} alert salvato in locale, API key fake non funzionante.
          </p>
          <p className="text-xs text-amber-800/80 mt-0.5">
            Tier Trading 999€/mese: alert illimitati, email/Slack/webhook real, API key dedicata,
            5.000 req/min, webhook secret rotation.
          </p>
        </div>
        <Link
          href="/it/pro#early-access"
          className="inline-flex items-center justify-center rounded-md bg-amber-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-amber-500 transition-colors whitespace-nowrap"
        >
          Sblocca tutto
        </Link>
      </div>

      {/* ALERT BUILDER */}
      <AlertBuilderSection
        asset={asset}
        setAsset={setAsset}
        condition={condition}
        setCondition={setCondition}
        threshold={threshold}
        setThreshold={setThreshold}
        canAddMore={canAddMore}
        onAdd={addAlert}
        spot={spot}
      />

      {/* ALERT LIST */}
      <AlertListSection alerts={alerts} spot={spot} onRemove={removeAlert} />

      {/* API EXPLORER */}
      <ApiExplorerSection />

      {/* LOCKED FEATURES */}
      <section className="grid gap-3 sm:grid-cols-3 pt-2">
        <LockedFeature
          title="Webhook secret rotation"
          description="HMAC sha256 signed webhooks con rotazione secret on-demand."
        />
        <LockedFeature
          title="Rate limit 5.000 req/min"
          description="Sliding window per chiave, 429 with Retry-After header."
        />
        <LockedFeature
          title="OpenAPI 3.1 spec"
          description="Schema YAML scaricabile per generazione client TypeScript/Python."
        />
      </section>
    </div>
  );
}

// ============================================================
// ALERT BUILDER
// ============================================================

function AlertBuilderSection({
  asset,
  setAsset,
  condition,
  setCondition,
  threshold,
  setThreshold,
  canAddMore,
  onAdd,
  spot,
}: {
  asset: AlertAsset;
  setAsset: (a: AlertAsset) => void;
  condition: AlertCondition;
  setCondition: (c: AlertCondition) => void;
  threshold: string;
  setThreshold: (t: string) => void;
  canAddMore: boolean;
  onAdd: () => void;
  spot: { pun: number; psv: number; ttf: number; spark: number };
}) {
  const currentValue = spot[asset];
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-stone-900">Crea alert</h2>
        <span className="text-xs text-stone-500">
          Valore corrente {ASSET_LABELS[asset]}:{" "}
          <strong className="text-stone-700 tabular-nums">
            {NUM2.format(currentValue)} €/MWh
          </strong>
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <label
            htmlFor="alert-asset"
            className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500"
          >
            Asset
          </label>
          <select
            id="alert-asset"
            value={asset}
            onChange={(e) => setAsset(e.target.value as AlertAsset)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {(Object.keys(ASSET_LABELS) as AlertAsset[]).map((a) => (
              <option key={a} value={a}>
                {ASSET_LABELS[a]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="alert-condition"
            className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500"
          >
            Condizione
          </label>
          <select
            id="alert-condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value as AlertCondition)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="above">sopra (&gt;)</option>
            <option value="below">sotto (&lt;)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="alert-threshold"
            className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500"
          >
            Soglia (€/MWh)
          </label>
          <input
            id="alert-threshold"
            type="number"
            inputMode="decimal"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            min="0"
            step="0.5"
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-mono tabular-nums text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="space-y-1 flex flex-col justify-end">
          <button
            type="button"
            onClick={onAdd}
            disabled={!canAddMore}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-colors ${
              canAddMore
                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                : "bg-stone-200 text-stone-400 cursor-not-allowed"
            }`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Crea alert
          </button>
        </div>
      </div>

      {/* DESTINATIONS row */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          Destinazione (email default · altri canali Trading 999€)
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DESTINATION_LABELS) as AlertDestination[]).map((d) => {
            const locked = LOCKED_DESTINATIONS.includes(d);
            return (
              <span
                key={d}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${
                  locked
                    ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}
              >
                {locked && <Lock className="h-3 w-3" aria-hidden />}
                {DESTINATION_LABELS[d]}
                {locked && <span className="ml-0.5 text-[10px]">paid</span>}
              </span>
            );
          })}
        </div>
      </div>

      {!canAddMore && (
        <p className="text-xs text-amber-700 font-medium">
          ⚠ Demo limit: massimo {DEMO_MAX_ALERTS} alert. Rimuovi quello esistente per crearne un
          altro, oppure{" "}
          <Link href="/it/pro#early-access" className="underline font-bold">
            sblocca con Trading 999€/mese
          </Link>
          .
        </p>
      )}
    </section>
  );
}

// ============================================================
// ALERT LIST
// ============================================================

function AlertListSection({
  alerts,
  spot,
  onRemove,
}: {
  alerts: AlertConfig[];
  spot: { pun: number; psv: number; ttf: number; spark: number };
  onRemove: (id: string) => void;
}) {
  if (alerts.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/40 p-8 text-center">
        <BellRing className="h-8 w-8 text-stone-400 mx-auto mb-2" aria-hidden />
        <p className="text-sm text-stone-600">
          Nessun alert configurato. Usa il form sopra per crearne uno.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
      <h2 className="font-semibold text-stone-900">Alert configurati ({alerts.length})</h2>
      <ul className="space-y-2">
        {alerts.map((a) => (
          <AlertRow key={a.id} alert={a} spot={spot} onRemove={onRemove} />
        ))}
      </ul>
    </section>
  );
}

function AlertRow({
  alert,
  spot,
  onRemove,
}: {
  alert: AlertConfig;
  spot: { pun: number; psv: number; ttf: number; spark: number };
  onRemove: (id: string) => void;
}) {
  const currentValue = spot[alert.asset];
  const isTriggered =
    alert.condition === "above"
      ? currentValue > alert.thresholdEurPerMwh
      : currentValue < alert.thresholdEurPerMwh;
  const distance = alert.thresholdEurPerMwh - currentValue;
  const distancePct = currentValue !== 0 ? (distance / currentValue) * 100 : 0;

  return (
    <li
      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
        isTriggered
          ? "border-rose-300 bg-rose-50/40"
          : "border-stone-200 bg-stone-50/30 hover:bg-stone-50"
      }`}
    >
      <div
        className={`h-2 w-2 rounded-full mt-2 ${
          isTriggered ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
        }`}
        aria-hidden
      />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-semibold text-stone-900">
          {ASSET_LABELS[alert.asset]} {CONDITION_LABELS[alert.condition]}{" "}
          <span className="tabular-nums">{NUM2.format(alert.thresholdEurPerMwh)}</span> €/MWh
          {isTriggered && (
            <span className="ml-2 inline-flex items-center rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-800">
              TRIGGER
            </span>
          )}
        </p>
        <p className="text-xs text-stone-600">
          Valore corrente:{" "}
          <strong className="tabular-nums">{NUM2.format(currentValue)} €/MWh</strong> · distanza{" "}
          <span className="tabular-nums">
            {distance > 0 ? "+" : ""}
            {NUM2.format(distance)} €/MWh
          </span>{" "}
          ({distancePct > 0 ? "+" : ""}
          {NUM2.format(distancePct)}%) · destinazione {DESTINATION_LABELS[alert.destination]}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          disabled
          title="Send test trigger — Trading 999€/mese"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold bg-stone-100 text-stone-400 cursor-not-allowed"
        >
          <Send className="h-3 w-3" aria-hidden />
          test
          <Lock className="h-2.5 w-2.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onRemove(alert.id)}
          aria-label="Rimuovi alert"
          className="inline-flex items-center justify-center rounded-md p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

// ============================================================
// API EXPLORER
// ============================================================

type Lang = "curl" | "python" | "javascript";

interface ApiEndpoint {
  method: "GET";
  path: string;
  description: string;
  exampleResponse: object;
}

const ENDPOINTS: ApiEndpoint[] = [
  {
    method: "GET",
    path: "/api/v1/vitals/spark",
    description: "Spark spread Italia corrente + percentili 30g (10/25/50/75/90).",
    exampleResponse: {
      current: 12.45,
      unit: "EUR/MWh",
      percentiles: { p10: -8.2, p25: 4.1, p50: 11.8, p75: 19.4, p90: 27.1 },
      asOf: "2026-05-19T14:00:00Z",
    },
  },
  {
    method: "GET",
    path: "/api/v1/risk/portfolio",
    description: "VaR 95% + MtM aggregato del portafoglio open positions.",
    exampleResponse: {
      mtmTotalEur: -12450.5,
      varEur95: 38200.0,
      stressLossEur: 152000.0,
      hedgeRatioSuggested: 0.65,
      positionsCount: 3,
      asOf: "2026-05-19T14:00:00Z",
    },
  },
  {
    method: "GET",
    path: "/api/v1/forecast?asset=pun&horizon=30",
    description: "Forecast PUN/PSV/TTF su orizzonte 7/30/90/180/365 giorni.",
    exampleResponse: {
      asset: "pun",
      horizonDays: 30,
      value: 108.42,
      lower95: 92.1,
      upper95: 124.8,
      modelVersion: "ridge-v1.0",
      mape180: 0.0692,
      asOf: "2026-05-19T14:00:00Z",
    },
  },
  {
    method: "GET",
    path: "/api/v1/backtest/run?strategy=mean-reversion-pun&months=12",
    description: "Esegui backtest preset e ritorna equity curve + metriche.",
    exampleResponse: {
      strategy: "mean-reversion-pun",
      months: 12,
      sharpe: 1.42,
      maxDrawdownPct: 0.085,
      totalReturnPct: 0.184,
      numTrades: 47,
      winRate: 0.553,
    },
  },
];

function ApiExplorerSection() {
  const [lang, setLang] = useState<Lang>("curl");
  const [openEndpoint, setOpenEndpoint] = useState<number | null>(0);
  const [keyCopied, setKeyCopied] = useState(false);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(DEMO_API_KEY);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-stone-900 flex items-center gap-2">
          <Code2 className="h-4 w-4" aria-hidden />
          API explorer
        </h2>
        <span className="text-xs text-stone-500">REST · JSON · auth via Bearer token</span>
      </div>

      {/* API KEY */}
      <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 space-y-2">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            La tua API key (demo)
          </p>
          <Link
            href="/it/pro#early-access"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-600 underline"
          >
            Genera chiave reale →
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 rounded-md bg-stone-900 text-emerald-300 px-3 py-2 text-xs font-mono tabular-nums overflow-x-auto">
            {DEMO_API_KEY}
          </code>
          <button
            type="button"
            onClick={copyKey}
            aria-label="Copia API key"
            className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white p-2 text-stone-600 hover:bg-stone-100 transition-colors"
          >
            {keyCopied ? (
              <Check className="h-4 w-4 text-emerald-600" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        <p className="text-[11px] text-amber-700 font-medium">
          ⚠ Chiave demo non funzionante — gli endpoint vanno live al lancio Q3 2026.
        </p>
      </div>

      {/* LANG TABS */}
      <div className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 p-0.5">
        {(["curl", "python", "javascript"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              lang === l
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            {l === "curl" ? "cURL" : l === "python" ? "Python" : "JavaScript"}
          </button>
        ))}
      </div>

      {/* ENDPOINTS */}
      <ul className="space-y-2">
        {ENDPOINTS.map((ep, i) => {
          const open = openEndpoint === i;
          return (
            <li key={ep.path} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenEndpoint(open ? null : i)}
                className="w-full flex items-baseline gap-3 p-3 text-left hover:bg-stone-50 transition-colors"
              >
                <span className="inline-flex items-center rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0">
                  {ep.method}
                </span>
                <code className="text-xs font-mono text-stone-900 flex-1 min-w-0 break-all">
                  {ep.path}
                </code>
                <span className="text-stone-400 text-xs shrink-0">{open ? "−" : "+"}</span>
              </button>
              {open && (
                <div className="border-t border-stone-200 p-3 space-y-3 bg-stone-50/40">
                  <p className="text-xs text-stone-600">{ep.description}</p>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500 mb-1">
                      Esempio richiesta
                    </p>
                    <pre className="rounded bg-stone-900 text-emerald-200 p-3 text-[11px] font-mono overflow-x-auto">
                      {renderSnippet(lang, ep.path)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500 mb-1">
                      Esempio response 200 OK
                    </p>
                    <pre className="rounded bg-stone-900 text-stone-100 p-3 text-[11px] font-mono overflow-x-auto">
                      {JSON.stringify(ep.exampleResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function renderSnippet(lang: Lang, path: string): string {
  const url = `https://api.energyindex.it${path}`;
  switch (lang) {
    case "curl":
      return `curl -X GET "${url}" \\\n  -H "Authorization: Bearer ${DEMO_API_KEY}" \\\n  -H "Accept: application/json"`;
    case "python":
      return `import requests\n\nr = requests.get(\n    "${url}",\n    headers={"Authorization": "Bearer ${DEMO_API_KEY}"},\n)\nprint(r.json())`;
    case "javascript":
      return `const res = await fetch("${url}", {\n  headers: { Authorization: "Bearer ${DEMO_API_KEY}" },\n});\nconst data = await res.json();\nconsole.log(data);`;
  }
}

// ============================================================
// LOCKED FEATURE TILE (small)
// ============================================================

function LockedFeature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/40 p-4 flex items-start gap-3 opacity-75">
      <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
      <div className="space-y-0.5">
        <p className="text-sm font-bold text-stone-700">{title}</p>
        <p className="text-xs text-stone-600">{description}</p>
      </div>
    </div>
  );
}
