"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TradingVitalsView } from "./TradingVitalsView";
import { RiskHedgingView } from "./RiskHedgingView";
import { BacktestView } from "./BacktestView";
import { AlertApiView } from "./AlertApiView";
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
  { id: "backtest", label: "Backtest engine", icon: FlaskConical },
  { id: "alert", label: "Alert & API", icon: BellRing },
];

type VitalsProps = ComponentProps<typeof TradingVitalsView>;
type RiskProps = ComponentProps<typeof RiskHedgingView>;
type BacktestProps = ComponentProps<typeof BacktestView>;
type AlertProps = ComponentProps<typeof AlertApiView>;

export function TradingDashboardView({
  activeTab,
  vitals,
  risk,
  backtest,
  alert,
}: {
  activeTab: Tab;
  vitals: VitalsProps;
  risk: RiskProps;
  backtest: BacktestProps;
  alert: AlertProps;
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
        {activeTab === "backtest" && <BacktestView {...backtest} />}
        {activeTab === "alert" && <AlertApiView {...alert} />}
      </div>

      <footer className="pt-6 border-t border-stone-200 text-xs text-stone-500">
        Demo pubblica pre-launch · funzioni avanzate sui piani Trading 999€/mese e Enterprise
        3.500€/mese.
      </footer>
    </div>
  );
}
