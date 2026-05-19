"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp,
  Users,
  LineChart,
  FileText,
  AlertTriangle,
  Heart,
  Sliders,
  ClipboardSignature,
} from "lucide-react";
import type { ComponentProps } from "react";
import { MarginSimulator } from "./MarginSimulator";
import { CustomerSimulator } from "./CustomerSimulator";
import { ForecastScenariView } from "./ForecastScenariView";
import { ReportBuilderView } from "./ReportBuilderView";
import { ChurnPredictorView } from "./ChurnPredictorView";
import { WinbackOptimizerView } from "./WinbackOptimizerView";
import { DynamicPricingView } from "./DynamicPricingView";
import { QuoteBuilderView } from "./QuoteBuilderView";

type Tab =
  | "margin"
  | "customer"
  | "forecast"
  | "report"
  | "churn"
  | "winback"
  | "pricing"
  | "quote";

interface TabDef {
  id: Tab;
  label: string;
  icon: typeof TrendingUp;
  caption: string;
}

const TABS: TabDef[] = [
  {
    id: "margin",
    label: "Margin Simulator",
    icon: TrendingUp,
    caption: "Simula margine vendita su forecast PUN + benchmark competitor",
  },
  {
    id: "customer",
    label: "Customer Simulator",
    icon: Users,
    caption: "Trova l'offerta migliore mercato libero per ogni profilo cliente",
  },
  {
    id: "forecast",
    label: "Forecast & Scenari",
    icon: LineChart,
    caption: "Modifica i driver del PUN e vedi come si deforma il forecast",
  },
  {
    id: "report",
    label: "Report Builder",
    icon: FileText,
    caption: "Genera report PDF brandizzati con dati snapshot + forecast",
  },
  {
    id: "churn",
    label: "Churn Predictor",
    icon: AlertTriangle,
    caption: "Predice probabilita' di abbandono cliente nei prossimi 90 giorni",
  },
  {
    id: "winback",
    label: "Win-back",
    icon: Heart,
    caption: "Strategie ranked per riconquistare ex-clienti dopo perdita",
  },
  {
    id: "pricing",
    label: "Dynamic Pricing",
    icon: Sliders,
    caption: "Price ladder ottimale per cluster cliente dato competitor benchmark live",
  },
  {
    id: "quote",
    label: "Quote Builder",
    icon: ClipboardSignature,
    caption: "Quote PDF pronti in 30 secondi da template pre-configurati + forecast live",
  },
];

type MarginProps = ComponentProps<typeof MarginSimulator>;
type CustomerProps = ComponentProps<typeof CustomerSimulator>;
type ForecastProps = ComponentProps<typeof ForecastScenariView>;
type ReportProps = ComponentProps<typeof ReportBuilderView>;
type ChurnProps = ComponentProps<typeof ChurnPredictorView>;
type PricingProps = ComponentProps<typeof DynamicPricingView>;

export function MarketingDashboardView({
  activeTab,
  margin,
  customer,
  forecast,
  report,
  churn,
  pricing,
}: {
  activeTab: Tab;
  margin: MarginProps;
  customer: CustomerProps;
  forecast: ForecastProps;
  report: ReportProps;
  churn: ChurnProps;
  pricing: PricingProps;
}) {
  const pathname = usePathname() ?? "/it/pro/marketing";
  const activeMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <header className="space-y-1 max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Marketing Desk</h1>
        <p className="text-sm text-stone-600">
          4 tool integrati per chi vende energia: fornitori, broker, team commerciali. Demo
          gratuita pre-launch.
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
                      ? "border-sky-600 text-sky-700"
                      : "border-transparent text-stone-500 hover:text-stone-900 hover:border-stone-300"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="text-xs text-stone-500 px-1">{activeMeta.caption}</p>

      {/* TAB CONTENT */}
      <div className="pt-2">
        {activeTab === "margin" && <MarginSimulator {...margin} />}
        {activeTab === "customer" && <CustomerSimulator {...customer} />}
        {activeTab === "forecast" && <ForecastScenariView {...forecast} />}
        {activeTab === "report" && <ReportBuilderView {...report} />}
        {activeTab === "churn" && <ChurnPredictorView {...churn} />}
        {activeTab === "winback" && <WinbackOptimizerView />}
        {activeTab === "pricing" && <DynamicPricingView {...pricing} />}
        {activeTab === "quote" && <QuoteBuilderView />}
      </div>

      <footer className="pt-6 border-t border-stone-200 text-xs text-stone-500">
        Demo pubblica pre-launch · funzioni avanzate sui piani Pro 499€/mese e Enterprise
        3.500€/mese.
      </footer>
    </div>
  );
}
