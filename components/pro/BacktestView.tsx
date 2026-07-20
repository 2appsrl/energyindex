"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Lock, Play, FlaskConical } from "lucide-react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { simulate, type PricePoint } from "@/lib/pro/backtest-math";
import {
  STRATEGIES,
  getStrategy,
  type Strategy,
  type StrategyId,
} from "@/lib/pro/backtest-strategies";

const NUM2 = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUM0 = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 0,
});
const PCT1 = new Intl.NumberFormat("it-IT", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export interface BacktestViewProps {
  /** Serie storica PUN — gia' tagliata alla finestra demo (~90 giorni) dal server */
  punSeries: PricePoint[];
  /** PSV per spark spread arb (locked) */
  psvSeries: PricePoint[];
  /** CO2 per spark spread arb (locked) */
  co2Series: PricePoint[];
  /** Mesi di storia disponibili (demo: 3, paid: 12-24). Usato per UI banner. */
  historyMonths: number;
}

export function BacktestView({ punSeries, psvSeries, co2Series, historyMonths }: BacktestViewProps) {
  const [selectedId, setSelectedId] = useState<StrategyId>("mean-reversion-pun");
  const selected = useMemo(() => getStrategy(selectedId)!, [selectedId]);

  // Run backtest only for unlocked strategies
  const result = useMemo(() => {
    if (selected.locked) return null;
    if (punSeries.length < 10) return null;
    const signals = selected.signalFn(
      punSeries,
      { psv: psvSeries, co2: co2Series },
      selected.params,
    );
    return simulate(punSeries, signals, 1);
  }, [selected, punSeries, psvSeries, co2Series]);

  return (
    <div className="space-y-6">
      {/* DEMO BANNER */}
      <div className="rounded-2xl border border-amber-300/40 bg-amber-50/60 p-4 flex flex-wrap items-center gap-3 text-sm">
        <FlaskConical className="h-5 w-5 text-amber-700 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-900">
            Demo: {historyMonths} mesi di storia, 1 strategia sbloccata.
          </p>
          <p className="text-xs text-amber-800/80 mt-0.5">
            Tier Trading 999€/mese: 24 mesi storia, 4 strategie attive, parametri tweakabili,
            export CSV, salva backtest.
          </p>
        </div>
        <Link
          href="/it/pro#early-access"
          className="inline-flex items-center justify-center rounded-md bg-amber-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-amber-500 transition-colors whitespace-nowrap"
        >
          Sblocca tutto
        </Link>
      </div>

      {/* STRATEGY SELECTOR */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wide text-stone-500 font-semibold">
          Strategia
        </h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {STRATEGIES.map((s) => (
            <StrategyCard
              key={s.id}
              strategy={s}
              selected={s.id === selectedId}
              onSelect={() => !s.locked && setSelectedId(s.id)}
            />
          ))}
        </div>
        <p className="text-xs text-stone-600 pt-1">
          <strong>{selected.name}.</strong> {selected.description}
        </p>
      </section>

      {/* RESULT — either KPIs+chart or locked teaser */}
      {selected.locked ? (
        <LockedStrategyTeaser strategy={selected} />
      ) : result ? (
        <>
          <KpiStrip
            sharpe={result.metrics.sharpe}
            maxDdEur={result.metrics.maxDrawdownEur}
            maxDdPct={result.metrics.maxDrawdownPct}
            winRate={result.metrics.winRate}
            numTrades={result.metrics.numTrades}
            totalReturnEur={result.metrics.totalReturnEur}
            totalReturnPct={result.metrics.totalReturnPct}
            profitFactor={result.metrics.profitFactor}
          />
          <EquityCurveChart points={result.equityCurve} />
          <TradesTable trades={result.trades} />
        </>
      ) : (
        <p className="text-sm text-stone-500 italic">
          Dati insufficienti per eseguire il backtest (servono almeno 10 giorni di storico).
        </p>
      )}

      {/* LOCKED FEATURES TEASER */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2">
        <LockedFeature
          title="Salva backtest"
          description="Memorizza configurazione + parametri + risultati per confronti futuri."
        />
        <LockedFeature
          title="Export CSV / PDF"
          description="Scarica trade list e equity curve per integrazione con Excel / risk reports."
        />
        <LockedFeature
          title="Tweak parametri"
          description="Modifica finestra, sigma threshold, exit rules. Re-run istantaneo."
        />
      </section>
    </div>
  );
}

// ============================================================
// Strategy selector card
// ============================================================

function StrategyCard({
  strategy,
  selected,
  onSelect,
}: {
  strategy: Strategy;
  selected: boolean;
  onSelect: () => void;
}) {
  const isLocked = strategy.locked;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isLocked}
      className={`group text-left rounded-2xl border p-4 space-y-2 transition-all ${
        selected
          ? "border-emerald-500 bg-emerald-50/40 shadow-md shadow-emerald-500/10"
          : isLocked
            ? "border-amber-300/50 bg-amber-50/30 cursor-not-allowed opacity-75"
            : "border-stone-200 bg-white hover:border-stone-400 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-bold uppercase tracking-widest ${
            isLocked ? "text-amber-700" : selected ? "text-emerald-700" : "text-stone-500"
          }`}
        >
          {isLocked ? "Trading 999€" : selected ? "Selezionata" : "Demo"}
        </span>
        {isLocked ? (
          <Lock className="h-3.5 w-3.5 text-amber-600" aria-hidden />
        ) : selected ? (
          <Play className="h-3.5 w-3.5 text-emerald-600 fill-emerald-600" aria-hidden />
        ) : null}
      </div>
      <h3 className="font-bold text-stone-900 text-sm leading-tight">{strategy.name}</h3>
      <p className="text-xs text-stone-600 line-clamp-2">{strategy.description}</p>
    </button>
  );
}

// ============================================================
// KPI strip
// ============================================================

function KpiStrip({
  sharpe,
  maxDdEur,
  maxDdPct,
  winRate,
  numTrades,
  totalReturnEur,
  totalReturnPct,
  profitFactor,
}: {
  sharpe: number;
  maxDdEur: number;
  maxDdPct: number;
  winRate: number;
  numTrades: number;
  totalReturnEur: number;
  totalReturnPct: number;
  profitFactor: number;
}) {
  const isProfit = totalReturnEur > 0;
  return (
    <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <Kpi
        label="Return totale"
        value={`${isProfit ? "+" : ""}${NUM2.format(totalReturnEur)} €`}
        sub={`${isProfit ? "+" : ""}${PCT1.format(totalReturnPct)}`}
        accent={isProfit ? "emerald" : "rose"}
      />
      <Kpi
        label="Sharpe ratio"
        value={NUM2.format(sharpe)}
        sub="annualizzato"
        accent={sharpe > 1 ? "emerald" : sharpe > 0 ? "stone" : "rose"}
      />
      <Kpi
        label="Max drawdown"
        value={`-${NUM2.format(maxDdEur)} €`}
        sub={maxDdPct > 0 ? `-${PCT1.format(maxDdPct)} vs peak` : "n/d"}
        accent="rose"
      />
      <Kpi
        label="Win rate"
        value={`${PCT1.format(winRate)}`}
        sub={`${numTrades} trade · PF ${
          Number.isFinite(profitFactor) ? NUM2.format(profitFactor) : "∞"
        }`}
        accent={winRate > 0.5 ? "emerald" : "stone"}
      />
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "emerald" | "rose" | "stone";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "rose"
        ? "text-rose-700"
        : "text-stone-800";
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="text-[11px] uppercase tracking-wide text-stone-500 font-semibold">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accentClass}`}>{value}</p>
      <p className="text-xs text-stone-500 mt-0.5">{sub}</p>
    </div>
  );
}

// ============================================================
// Equity curve chart (lightweight-charts)
// ============================================================

function EquityCurveChart({
  points,
}: {
  points: Array<{ date: string; equity: number; drawdownEur: number }>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 280,
      layout: {
        background: { color: "transparent" },
        textColor: "#1f2937",
      },
      grid: {
        vertLines: { color: "#e5e7eb" },
        horzLines: { color: "#e5e7eb" },
      },
      timeScale: { timeVisible: false, secondsVisible: false },
      localization: {
        priceFormatter: (v: number) => `${NUM0.format(v)} €`,
      },
      rightPriceScale: { borderColor: "#d6d3d1" },
    });

    const equityLine = chart.addSeries(LineSeries, {
      color: "#059669",
      lineWidth: 2,
      title: "Equity curve",
    });
    equityLine.setData(
      points.map((p) => ({
        time: Math.floor(new Date(p.date).getTime() / 1000) as Time,
        value: p.equity,
      })),
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const onResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [points]);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-stone-900">Equity curve</h3>
        <span className="text-xs text-stone-500">P&amp;L cumulato — 1 MWh per trade</span>
      </div>
      <div ref={containerRef} className="w-full" />
    </section>
  );
}

// ============================================================
// Trades list (last 10)
// ============================================================

function TradesTable({
  trades,
}: {
  trades: Array<{
    entryDate: string;
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    side: "long" | "short";
    pnlEur: number;
    pnlPct: number;
    durationDays: number;
  }>;
}) {
  if (trades.length === 0) {
    return (
      <p className="text-sm text-stone-500 italic">
        La strategia non ha generato trade nel periodo analizzato.
      </p>
    );
  }
  const last10 = trades.slice(-10).reverse();
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-stone-900">Ultimi trade</h3>
        <span className="text-xs text-stone-500">
          {trades.length} trade totali · mostrati gli ultimi {Math.min(10, trades.length)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-stone-500 border-b border-stone-200">
              <th className="text-left py-2 font-semibold">Entry</th>
              <th className="text-left py-2 font-semibold">Exit</th>
              <th className="text-left py-2 font-semibold">Side</th>
              <th className="text-right py-2 font-semibold">Entry €</th>
              <th className="text-right py-2 font-semibold">Exit €</th>
              <th className="text-right py-2 font-semibold">P&amp;L</th>
              <th className="text-right py-2 font-semibold">%</th>
              <th className="text-right py-2 font-semibold">Giorni</th>
            </tr>
          </thead>
          <tbody>
            {last10.map((t, i) => (
              <tr key={`${t.entryDate}-${i}`} className="border-b border-stone-100">
                <td className="py-2 tabular-nums text-stone-700">{t.entryDate}</td>
                <td className="py-2 tabular-nums text-stone-700">{t.exitDate}</td>
                <td className="py-2">
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      t.side === "long"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {t.side}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums">{NUM2.format(t.entryPrice)}</td>
                <td className="py-2 text-right tabular-nums">{NUM2.format(t.exitPrice)}</td>
                <td
                  className={`py-2 text-right tabular-nums font-semibold ${
                    t.pnlEur > 0 ? "text-emerald-700" : t.pnlEur < 0 ? "text-rose-700" : "text-stone-600"
                  }`}
                >
                  {t.pnlEur > 0 ? "+" : ""}
                  {NUM2.format(t.pnlEur)}
                </td>
                <td
                  className={`py-2 text-right tabular-nums ${
                    t.pnlPct > 0 ? "text-emerald-700" : t.pnlPct < 0 ? "text-rose-700" : "text-stone-600"
                  }`}
                >
                  {t.pnlPct > 0 ? "+" : ""}
                  {PCT1.format(t.pnlPct)}
                </td>
                <td className="py-2 text-right tabular-nums text-stone-600">{t.durationDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================
// Locked strategy teaser (when user clicks a 🔒 strategy — but in current UI
// these cards are disabled, so this is a defensive fallback)
// ============================================================

function LockedStrategyTeaser({ strategy }: { strategy: Strategy }) {
  return (
    <section className="rounded-2xl border border-amber-300/40 bg-amber-50/40 p-8 text-center space-y-3 max-w-2xl mx-auto">
      <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 text-amber-800 px-3 py-1 text-xs font-bold uppercase tracking-widest">
        <Lock className="h-3 w-3" aria-hidden />
        Strategia premium
      </div>
      <h2 className="text-2xl font-bold">{strategy.name}</h2>
      <p className="text-sm text-stone-600 max-w-md mx-auto">{strategy.description}</p>
      <Link
        href="/it/pro#early-access"
        className="inline-flex items-center justify-center rounded-md bg-amber-600 text-white px-4 py-2 text-sm font-bold hover:bg-amber-500 transition-colors"
      >
        Sblocca con Trading 999€/mese
      </Link>
    </section>
  );
}

// ============================================================
// Locked feature card (small)
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
