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
  Target,
  Send,
  Globe,
  FileCheck2,
} from "lucide-react";
import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { MarginSimulator } from "./MarginSimulator";
import { CustomerSimulator } from "./CustomerSimulator";
import { ForecastScenariView } from "./ForecastScenariView";
import { ReportBuilderView } from "./ReportBuilderView";
import { ChurnPredictorView } from "./ChurnPredictorView";
import { WinbackOptimizerView } from "./WinbackOptimizerView";
import { DynamicPricingView } from "./DynamicPricingView";
import { QuoteBuilderView } from "./QuoteBuilderView";
import { MarketOffersView } from "./MarketOffersView";
import { CTEBuilderView } from "./CTEBuilderView";

// ============================================================
// TYPES
// ============================================================

type Tab =
  | "margin"
  | "customer"
  | "forecast"
  | "report"
  | "churn"
  | "winback"
  | "pricing"
  | "quote"
  | "market-offers"
  | "cte-builder";

type Group = "acquisition" | "retention" | "pricing-strategy" | "output";

interface TabDef {
  id: Tab;
  label: string;
  icon: LucideIcon;
  caption: string;
}

interface GroupDef {
  id: Group;
  label: string;
  icon: LucideIcon;
  /** Tool ids in this group, ordered as they should appear in the sub-tabs */
  tools: Tab[];
}

// ============================================================
// REGISTRY: tools and groups
// ============================================================

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
    id: "quote",
    label: "Quote Builder",
    icon: ClipboardSignature,
    caption: "Quote PDF pronti in 30 secondi da template pre-configurati + forecast live",
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
    id: "market-offers",
    label: "Market Offers",
    icon: Globe,
    caption: "Mappa interattiva di tutte le offerte mercato libero italiano (PLACET + commerciali)",
  },
  {
    id: "cte-builder",
    label: "CTE Builder",
    icon: FileCheck2,
    caption: "Genera Condizioni Tecnico Economiche ARERA-compliant in pochi minuti",
  },
];

const GROUPS: GroupDef[] = [
  {
    id: "acquisition",
    label: "Acquisition",
    icon: Target,
    tools: ["margin", "customer", "quote"],
  },
  {
    id: "retention",
    label: "Retention",
    icon: Heart,
    tools: ["churn", "winback"],
  },
  {
    id: "pricing-strategy",
    label: "Pricing & Strategy",
    icon: Sliders,
    tools: ["pricing", "forecast", "market-offers"],
  },
  {
    id: "output",
    label: "Output",
    icon: Send,
    tools: ["report", "cte-builder"],
  },
];

function getGroupFromTab(tab: Tab): Group {
  for (const g of GROUPS) {
    if (g.tools.includes(tab)) return g.id;
  }
  return "acquisition";
}

function getTabDef(tab: Tab): TabDef {
  return TABS.find((t) => t.id === tab) ?? TABS[0];
}

// ============================================================
// COMPONENT
// ============================================================

type MarginProps = ComponentProps<typeof MarginSimulator>;
type CustomerProps = ComponentProps<typeof CustomerSimulator>;
type ForecastProps = ComponentProps<typeof ForecastScenariView>;
type ReportProps = ComponentProps<typeof ReportBuilderView>;
type ChurnProps = ComponentProps<typeof ChurnPredictorView>;
type PricingProps = ComponentProps<typeof DynamicPricingView>;
type CteBuilderProps = ComponentProps<typeof CTEBuilderView>;

export function MarketingDashboardView({
  activeTab,
  margin,
  customer,
  forecast,
  report,
  churn,
  pricing,
  cteBuilder,
}: {
  activeTab: Tab;
  margin: MarginProps;
  customer: CustomerProps;
  forecast: ForecastProps;
  report: ReportProps;
  churn: ChurnProps;
  pricing: PricingProps;
  cteBuilder: CteBuilderProps;
}) {
  const pathname = usePathname() ?? "/it/pro/marketing";
  const activeGroup = getGroupFromTab(activeTab);
  const activeGroupDef = GROUPS.find((g) => g.id === activeGroup) ?? GROUPS[0];
  const activeMeta = getTabDef(activeTab);

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <header className="space-y-1 max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Marketing Desk</h1>
        <p className="text-sm text-stone-600">
          8 tool integrati per chi vende energia: fornitori, broker, team commerciali. Demo
          gratuita pre-launch.
        </p>
      </header>

      {/* GROUP TABS (primary nav) */}
      <nav
        aria-label="Categorie tool"
        className="overflow-x-auto rounded-xl bg-sky-50/60 p-1.5 border border-sky-200/40"
      >
        <ul className="flex items-center gap-1">
          {GROUPS.map((g) => {
            const isActive = g.id === activeGroup;
            const Icon = g.icon;
            // Linka al primo tool del gruppo (default landing per quel gruppo)
            const defaultTool = g.tools[0];
            return (
              <li key={g.id} className="flex-1 min-w-[140px]">
                <Link
                  href={`${pathname}?tab=${defaultTool}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`group inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/20"
                      : "text-sky-800/70 hover:bg-sky-100 hover:text-sky-900"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span>{g.label}</span>
                  <span
                    className={`ml-1 text-[10px] font-mono ${
                      isActive ? "text-sky-100" : "text-sky-700/60"
                    }`}
                  >
                    {g.tools.length}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* TOOL TABS (secondary nav, scoped to active group) */}
      <nav
        aria-label={`Tool del gruppo ${activeGroupDef.label}`}
        className="border-b border-stone-200 overflow-x-auto"
      >
        <ul className="flex items-center gap-1 -mb-px">
          {activeGroupDef.tools.map((toolId) => {
            const t = getTabDef(toolId);
            const isActive = t.id === activeTab;
            const Icon = t.icon;
            return (
              <li key={t.id}>
                <Link
                  href={`${pathname}?tab=${t.id}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`group inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
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
        {activeTab === "market-offers" && <MarketOffersView />}
        {activeTab === "cte-builder" && <CTEBuilderView {...cteBuilder} />}
      </div>

      <footer className="pt-6 border-t border-stone-200 text-xs text-stone-500">
        Demo pubblica pre-launch · funzioni avanzate sui piani Pro 499€/mese e Enterprise
        3.500€/mese.
      </footer>
    </div>
  );
}
