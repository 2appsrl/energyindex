"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computePositionMtm,
  computePortfolioSummary,
  computeVaR,
  computeStressTest,
  daysToDelivery,
  nearestForecastHorizon,
  STRESS_SCENARIOS,
  type Position,
  type AssetSlug,
  type Side,
  type PositionMtm,
  type PortfolioSummary,
  type VaRMetrics,
  type StressResult,
} from "@/lib/pro/risk-math";

const EUR = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const PCT1 = new Intl.NumberFormat("it-IT", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const STORAGE_KEY = "eidx-pro-positions";

interface Props {
  forecastsByHorizon: Record<number, { pun: number; psv: number; ttf: number }>;
  atrPct: { pun: number; psv: number; ttf: number };
  spot: { pun: number; psv: number; ttf: number };
}

function loadPositionsFromStorage(): Position[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Position[]) : [];
  } catch {
    return [];
  }
}

function persistPositions(positions: Position[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // ignore quota errors
  }
}

export function RiskHedgingView({ forecastsByHorizon, atrPct, spot }: Props) {
  // SSR-safe: parte vuoto, popolato dopo l'hydration via useEffect dedicato
  // (mantiene lo stesso markup tra server e client al primo render).
  const [positions, setPositionsRaw] = useState<Position[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate da localStorage una sola volta dopo il mount. setState in effect
  // qui e' inevitabile (storage e' un'API esterna) ma lo facciamo solo al
  // primo render — SSR-safe perche' al server positions = [].
  useEffect(() => {
    const stored = loadPositionsFromStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored.length > 0) setPositionsRaw(stored);
    setHydrated(true);
  }, []);

  // Wrapper che aggiorna state + persiste in un unico passaggio: niente
  // effect "echo" che osserva positions per scriverle indietro nello storage.
  function setPositions(updater: Position[] | ((prev: Position[]) => Position[])) {
    setPositionsRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (hydrated) persistPositions(next);
      return next;
    });
  }

  // Compute MtM per posizione (usando il horizon piu' vicino al delivery)
  const positionMtms = useMemo(() => {
    return positions.map((p) => {
      const days = daysToDelivery(p.deliveryMonth);
      const horizon = nearestForecastHorizon(days);
      const fc = forecastsByHorizon[horizon];
      return computePositionMtm(p, fc, atrPct, days);
    });
  }, [positions, forecastsByHorizon, atrPct]);

  // Baseline forecast per stress test = horizon 30g (centroide)
  const baselineFc = forecastsByHorizon[30];

  const summary = useMemo(() => computePortfolioSummary(positionMtms), [positionMtms]);
  const varMetrics = useMemo(() => computeVaR(summary, atrPct), [summary, atrPct]);
  const stress = useMemo(
    () => STRESS_SCENARIOS.map((s) => computeStressTest(positionMtms, summary, s, baselineFc)),
    [positionMtms, summary, baselineFc],
  );

  function addSample() {
    const samples: Position[] = [
      {
        id: crypto.randomUUID(),
        asset: "pun",
        side: "BUY",
        volumeMwh: 500,
        executedPriceEurPerMwh: 105,
        deliveryMonth: "2026-07",
      },
      {
        id: crypto.randomUUID(),
        asset: "psv",
        side: "SELL",
        volumeMwh: 200,
        executedPriceEurPerMwh: 35,
        deliveryMonth: "2026-08",
      },
      {
        id: crypto.randomUUID(),
        asset: "ttf",
        side: "BUY",
        volumeMwh: 300,
        executedPriceEurPerMwh: 32,
        deliveryMonth: "2026-09",
      },
    ];
    setPositions((prev) => [...prev, ...samples]);
  }

  function clearAll() {
    setPositions([]);
  }

  return (
    <div className="space-y-6">
      <PositionList
        positions={positions}
        mtms={positionMtms}
        onAdd={(p) => setPositions((prev) => [...prev, p])}
        onRemove={(id) => setPositions((prev) => prev.filter((x) => x.id !== id))}
        onAddSample={addSample}
        onClearAll={clearAll}
        spot={spot}
      />

      {positions.length > 0 && (
        <>
          <SummaryCards summary={summary} varMetrics={varMetrics} />
          <StressTable results={stress} totalExposure={summary.totalExposureEur} />
          <HedgeTable mtms={positionMtms} />
        </>
      )}
    </div>
  );
}

function PositionList({
  positions,
  mtms,
  onAdd,
  onRemove,
  onAddSample,
  onClearAll,
  spot,
}: {
  positions: Position[];
  mtms: PositionMtm[];
  onAdd: (p: Position) => void;
  onRemove: (id: string) => void;
  onAddSample: () => void;
  onClearAll: () => void;
  spot: { pun: number; psv: number; ttf: number };
}) {
  const [asset, setAsset] = useState<AssetSlug>("pun");
  const [side, setSide] = useState<Side>("BUY");
  const [volume, setVolume] = useState(100);
  // Pre-fill iniziale con lo spot di PUN (asset default). L'utente puo'
  // riempire/sovrascrivere a mano; quando cambia asset, riempiamo con lo
  // spot del nuovo asset solo se il campo era vuoto/zero.
  const [price, setPrice] = useState(() => (spot.pun > 0 ? Math.round(spot.pun) : 0));
  const [deliveryMonth, setDeliveryMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  function handleAssetChange(next: AssetSlug) {
    setAsset(next);
    // Suggerisci il prezzo spot del nuovo asset solo se l'utente non ha gia'
    // inserito un valore proprio (oppure se stava usando il suggerimento
    // dell'asset precedente, che riconosciamo confrontando con lo spot
    // corrente).
    if (price === 0 || price === Math.round(spot[asset])) {
      if (spot[next] > 0) setPrice(Math.round(spot[next]));
    }
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (volume <= 0 || price <= 0) return;
    onAdd({
      id: crypto.randomUUID(),
      asset,
      side,
      volumeMwh: volume,
      executedPriceEurPerMwh: price,
      deliveryMonth,
    });
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm uppercase tracking-wide text-stone-500 font-semibold">
          Posizioni open
        </h2>
        <div className="flex gap-2">
          {positions.length === 0 && (
            <button
              type="button"
              onClick={onAddSample}
              className="text-xs px-3 py-1.5 rounded-md border border-stone-300 hover:bg-stone-50"
            >
              + Carica posizioni esempio
            </button>
          )}
          {positions.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs px-3 py-1.5 rounded-md border border-stone-300 hover:bg-stone-50"
            >
              Svuota tutto
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={handleAdd}
        className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]"
      >
        <select
          value={asset}
          onChange={(e) => handleAssetChange(e.target.value as AssetSlug)}
          className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
          aria-label="Asset"
        >
          <option value="pun">PUN</option>
          <option value="psv">PSV</option>
          <option value="ttf">TTF</option>
        </select>
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as Side)}
          className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
          aria-label="Side"
        >
          <option value="BUY">BUY (long)</option>
          <option value="SELL">SELL (short)</option>
        </select>
        <input
          type="number"
          min="1"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          placeholder="MWh"
          aria-label="Volume MWh"
          className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          placeholder="€/MWh"
          aria-label="Prezzo eseguito"
          className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
        />
        <input
          type="month"
          value={deliveryMonth}
          onChange={(e) => setDeliveryMonth(e.target.value)}
          aria-label="Delivery month"
          className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="px-4 py-1.5 rounded-md bg-[#0a3d2e] text-white text-sm font-semibold"
        >
          + Aggiungi
        </button>
      </form>

      {positions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs uppercase text-stone-500">
                <th className="text-left py-2 pr-3">Asset</th>
                <th className="text-left py-2 pr-3">Side</th>
                <th className="text-right py-2 pr-3">Volume</th>
                <th className="text-right py-2 pr-3">Prezzo eseguito</th>
                <th className="text-left py-2 pr-3">Delivery</th>
                <th className="text-right py-2 pr-3">Forecast atteso</th>
                <th className="text-right py-2 pr-3">MtM €</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, idx) => {
                const m = mtms[idx];
                const positive = m.mtmEur >= 0;
                return (
                  <tr key={p.id} className="border-b border-stone-100">
                    <td className="py-2 pr-3 font-semibold uppercase">{p.asset}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={p.side === "BUY" ? "text-emerald-700" : "text-rose-700"}
                      >
                        {p.side}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.volumeMwh} MWh</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {p.executedPriceEurPerMwh.toFixed(2)}
                    </td>
                    <td className="py-2 pr-3">{p.deliveryMonth}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {m.forecastPriceEurPerMwh.toFixed(2)}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums font-semibold ${
                        positive ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {EUR.format(m.mtmEur)}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onRemove(p.id)}
                        className="text-xs text-stone-400 hover:text-rose-600"
                        aria-label={`Rimuovi posizione ${p.asset}`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-stone-500 italic">
          Nessuna posizione open. Aggiungi tramite il form sopra o carica posizioni esempio per
          vedere il funzionamento.
        </p>
      )}
    </section>
  );
}

function SummaryCards({
  summary,
  varMetrics,
}: {
  summary: PortfolioSummary;
  varMetrics: VaRMetrics;
}) {
  const netPositive = summary.netMtmEur >= 0;
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <KpiBox label="Esposizione totale" value={EUR.format(summary.totalExposureEur)} />
      <KpiBox
        label="Net MtM"
        value={(netPositive ? "+" : "") + EUR.format(summary.netMtmEur)}
        highlight={netPositive ? "positive" : "negative"}
      />
      <KpiBox
        label="VaR 1g 95%"
        value={EUR.format(varMetrics.var1d95)}
        subline={`Volatility ${(varMetrics.portfolioVolatilityPct * 100).toFixed(2)}% giornaliera`}
      />
      <KpiBox
        label="VaR 10g 99%"
        value={EUR.format(varMetrics.var10d99)}
        subline="Worst case 10 giorni"
      />
    </div>
  );
}

function KpiBox({
  label,
  value,
  subline,
  highlight,
}: {
  label: string;
  value: string;
  subline?: string;
  highlight?: "positive" | "negative";
}) {
  const color =
    highlight === "positive"
      ? "text-emerald-700"
      : highlight === "negative"
        ? "text-rose-700"
        : "text-stone-900";
  const bg =
    highlight === "positive"
      ? "bg-emerald-50/60 border-emerald-200"
      : highlight === "negative"
        ? "bg-rose-50/60 border-rose-200"
        : "bg-white border-stone-200";
  return (
    <div className={`p-4 rounded-xl border ${bg}`}>
      <div className="text-xs text-stone-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      {subline && <div className="text-xs text-stone-500 mt-1">{subline}</div>}
    </div>
  );
}

function StressTable({
  results,
  totalExposure,
}: {
  results: StressResult[];
  totalExposure: number;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 space-y-3">
      <div>
        <h2 className="text-sm uppercase tracking-wide text-stone-500 font-semibold">
          Stress test scenari
        </h2>
        <p className="text-xs text-stone-600">
          Delta P&amp;L atteso sul portafoglio sotto shock di mercato.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs uppercase text-stone-500">
            <th className="text-left py-2 pr-3">Scenario</th>
            <th className="text-right py-2 pr-3">Delta P&amp;L €</th>
            <th className="text-right py-2">% esposizione</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const positive = r.deltaPnlEur >= 0;
            return (
              <tr key={r.scenario.id} className="border-b border-stone-100">
                <td className="py-2 pr-3">{r.scenario.label}</td>
                <td
                  className={`py-2 pr-3 text-right tabular-nums font-semibold ${
                    positive ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {positive ? "+" : ""}
                  {EUR.format(r.deltaPnlEur)}
                </td>
                <td
                  className={`py-2 text-right tabular-nums ${
                    positive ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {(positive ? "+" : "") + PCT1.format(r.pctOfExposure)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-stone-400 italic">
        Calcolato su forecast 30g baseline + shock %, esposizione totale{" "}
        {EUR.format(totalExposure)}.
      </p>
    </section>
  );
}

function HedgeTable({ mtms }: { mtms: PositionMtm[] }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 space-y-3">
      <div>
        <h2 className="text-sm uppercase tracking-wide text-stone-500 font-semibold">
          Hedge ratio suggerito
        </h2>
        <p className="text-xs text-stone-600">
          % del volume da coprire con strumenti forward, basato su volatility + tempo di
          esposizione.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs uppercase text-stone-500">
            <th className="text-left py-2 pr-3">Posizione</th>
            <th className="text-right py-2 pr-3">Volume</th>
            <th className="text-right py-2 pr-3">Hedge consigliato</th>
            <th className="text-right py-2">Volume hedge</th>
          </tr>
        </thead>
        <tbody>
          {mtms.map((m) => {
            const p = m.position;
            const hedgeVolume = p.volumeMwh * m.hedgeRatio;
            return (
              <tr key={p.id} className="border-b border-stone-100">
                <td className="py-2 pr-3">
                  <span className="font-semibold uppercase">{p.asset}</span>{" "}
                  <span
                    className={p.side === "BUY" ? "text-emerald-700" : "text-rose-700"}
                  >
                    {p.side}
                  </span>{" "}
                  · {p.deliveryMonth}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{p.volumeMwh} MWh</td>
                <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                  {PCT1.format(m.hedgeRatio)}
                </td>
                <td className="py-2 text-right tabular-nums text-stone-600">
                  {hedgeVolume.toFixed(1)} MWh
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
