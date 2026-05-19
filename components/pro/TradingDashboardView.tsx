"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TradingVitalsView } from "./TradingVitalsView";
import { RiskHedgingView } from "./RiskHedgingView";
import { Activity, Shield, FlaskConical, BellRing, Lock } from "lucide-react";
import type { ComponentProps } from "react";

type Tab = "vitals" | "risk" | "backtest" | "alert";

interface TabDef {
  id: Tab;
  label: string;
  icon: typeof Activity;
  locked?: boolean;
}

const TABS: TabDef[] = [
  { id: "vitals", label: "Trading Vitals", icon: Activity },
  { id: "risk", label: "Risk & Hedging", icon: Shield },
  { id: "backtest", label: "Backtest engine", icon: FlaskConical, locked: true },
  { id: "alert", label: "Alert & API", icon: BellRing, locked: true },
];

type VitalsProps = ComponentProps<typeof TradingVitalsView>;
type RiskProps = ComponentProps<typeof RiskHedgingView>;

export function TradingDashboardView({
  activeTab,
  vitals,
  risk,
}: {
  activeTab: Tab;
  vitals: VitalsProps;
  risk: RiskProps;
}) {
  const pathname = usePathname() ?? "/it/pro/trading";

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <header className="space-y-1 max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Trading Desk</h1>
        <p className="text-sm text-stone-600">
          4 tool integrati per il trader energy italiano. Demo gratuita pre-launch, dati live.
        </p>
      </header>

      {/* TABS bar */}
      <nav className="border-b border-stone-200 overflow-x-auto">
        <ul className="flex items-center gap-1 -mb-px">
          {TABS.map((t) => {
            const isActive = t.id === activeTab;
            const Icon = t.icon;
            return (
              <li key={t.id}>
                <Link
                  href={`${pathname}?tab=${t.id}`}
                  className={`group inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-stone-500 hover:text-stone-900 hover:border-stone-300"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span>{t.label}</span>
                  {t.locked && <Lock className="h-3 w-3 text-amber-600" aria-hidden />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* TAB CONTENT */}
      <div className="pt-2">
        {activeTab === "vitals" && <TradingVitalsView {...vitals} />}
        {activeTab === "risk" && <RiskHedgingView {...risk} />}
        {activeTab === "backtest" && (
          <LockedTab
            label="Backtest engine"
            eta="2027"
            description="Editor di strategie con DSL semplice, run su 5 anni di storico, output P&L cumulato + max drawdown + Sharpe ratio."
          />
        )}
        {activeTab === "alert" && (
          <LockedTab
            label="Alert & API"
            eta="2027"
            description="Trigger su soglie prezzo/spread/percentile + REST API per Excel proprietary models + plugin XLOOKUP."
          />
        )}
      </div>

      <footer className="pt-6 border-t border-stone-200 text-xs text-stone-500">
        Demo pubblica pre-launch · funzioni avanzate sui piani Trading 999€/mese e Enterprise
        3.500€/mese.
      </footer>
    </div>
  );
}

function LockedTab({
  label,
  eta,
  description,
}: {
  label: string;
  eta: string;
  description: string;
}) {
  return (
    <section className="rounded-2xl border border-amber-300/40 bg-amber-50/40 p-12 text-center space-y-3 max-w-2xl mx-auto">
      <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 text-amber-700 px-3 py-1 text-xs font-bold uppercase tracking-widest">
        <Lock className="h-3 w-3" aria-hidden />
        In arrivo {eta}
      </div>
      <h2 className="text-2xl font-bold">{label}</h2>
      <p className="text-sm text-stone-600 max-w-md mx-auto">{description}</p>
      <p className="text-xs text-stone-500 pt-2">
        Per accesso anticipato:{" "}
        <Link href="/it/pro#early-access" className="underline font-medium">
          registrati al lancio
        </Link>
      </p>
    </section>
  );
}
