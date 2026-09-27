import type { ReactNode } from "react";
import {
  BellRing,
  Bot,
  Calculator,
  Factory,
  Globe,
  Home,
  Sheet,
  Tags,
  type LucideIcon,
} from "lucide-react";
import type { TierId } from "@/lib/api/catalog";
import { TierBadge, TIER_STYLE } from "./badges";
import { cn } from "@/lib/utils";

/**
 * Galleria "cosa puoi costruire": ogni card ha un mock visivo del
 * risultato finale, cosi' il potenziale dell'API si capisce senza leggere
 * documentazione. I mock usano i valori live di PUN/PSV quando disponibili.
 */

const fmt = (v: number, d = 2) =>
  v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });

// Curva oraria tipica "a papera": sera cara, ore centrali spinte giu' dal solare.
const HOURLY = [104, 99, 95, 93, 94, 101, 118, 132, 121, 98, 84, 76, 72, 71, 74, 86, 109, 142, 166, 168, 151, 133, 121, 110];
const CHEAPEST = [...HOURLY.map((v, i) => [v, i] as const)].sort((a, b) => a[0] - b[0]).slice(0, 3).map(([, i]) => i);

interface UseCase {
  id: string;
  icon: LucideIcon;
  title: string;
  who: string;
  description: string;
  tier: TierId;
  endpoints: string[];
  visual: ReactNode;
}

function WidgetVisual({ pun, psv }: { pun: number; psv: number }) {
  return (
    <div className="mx-auto w-full max-w-xs rounded-xl bg-white p-3 text-stone-900 shadow-lg ring-1 ring-stone-200">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-stone-500">
        <span>Prezzi energia oggi</span>
        <span className="flex items-center gap-1 text-emerald-600">
          <span className="size-1.5 rounded-full bg-emerald-500" /> live
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[
          { k: "PUN", v: pun, d: "+1,6%", up: true },
          { k: "PSV", v: psv, d: "−0,8%", up: false },
        ].map((x) => (
          <div key={x.k} className="rounded-lg bg-stone-50 p-2">
            <div className="text-[10px] font-bold text-stone-500">{x.k}</div>
            <div className="font-mono text-lg font-black tabular-nums">{fmt(x.v)}</div>
            <div className={cn("text-[10px] font-bold", x.up ? "text-rose-600" : "text-emerald-600")}>
              {x.up ? "▲" : "▼"} {x.d} <span className="font-normal text-stone-400">€/MWh</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[9px] text-stone-400">Fonte: Energy Index</div>
    </div>
  );
}

function SheetsVisual() {
  const rows = [
    ["20/09", "112,40"],
    ["21/09", "104,87"],
    ["22/09", "121,06"],
    ["23/09", "124,31"],
  ];
  return (
    <div className="mx-auto w-full max-w-xs overflow-hidden rounded-lg bg-white text-stone-900 shadow-lg ring-1 ring-stone-200 text-[11px]">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-2 py-1 font-mono">
        <span className="font-bold italic text-stone-400">fx</span>
        <span className="truncate text-emerald-700">=IMPORTDATA(&quot;…/series?format=csv&quot;)</span>
      </div>
      <table className="w-full font-mono">
        <thead>
          <tr className="bg-stone-100 text-stone-500">
            <th className="w-6 border-r border-stone-200" />
            <th className="border-r border-stone-200 px-2 py-0.5 text-left font-normal">A · data</th>
            <th className="px-2 py-0.5 text-left font-normal">B · PUN €/MWh</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r[0]} className="border-t border-stone-100">
              <td className="border-r border-stone-200 bg-stone-100 text-center text-stone-400">{i + 1}</td>
              <td className="border-r border-stone-100 px-2 py-0.5">{r[0]}</td>
              <td className="px-2 py-0.5 text-right tabular-nums">{r[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HourlyVisual() {
  const max = Math.max(...HOURLY);
  return (
    <div className="mx-auto w-full max-w-xs rounded-xl bg-stone-950 p-3 text-stone-100 shadow-lg ring-1 ring-white/10">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-bold text-stone-400">PUN orario · domani</span>
        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-300">Lavatrice → 13:00</span>
      </div>
      <div className="mt-3 flex h-20 items-end gap-[3px]">
        {HOURLY.map((v, i) => (
          <div
            key={i}
            className={cn("flex-1 rounded-t-sm", CHEAPEST.includes(i) ? "bg-emerald-400" : v > 140 ? "bg-rose-400/70" : "bg-stone-600")}
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-stone-500">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
      </div>
    </div>
  );
}

function AlertVisual({ psv }: { psv: number }) {
  // Soglia "tonda" appena sotto il valore di oggi, cosi' il mock e' coerente.
  const threshold = Math.max(5, Math.ceil(psv / 5) * 5 - 5);
  return (
    <div className="mx-auto w-full max-w-xs space-y-2">
      <div className="flex gap-2 rounded-xl bg-white p-3 text-stone-900 shadow-lg ring-1 ring-stone-200">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-[10px] font-black text-white">EI</div>
        <div className="min-w-0 text-xs">
          <div className="flex items-baseline gap-2">
            <span className="font-bold">Energy Index</span>
            <span className="rounded bg-stone-100 px-1 text-[9px] font-bold text-stone-500">APP</span>
            <span className="text-[10px] text-stone-400">08:02</span>
          </div>
          <p className="mt-0.5">
            ⚠️ <strong>PSV sopra soglia</strong>: {fmt(psv)} €/MWh (soglia {fmt(threshold)})
          </p>
          <p className="text-[11px] text-stone-500">#acquisti-energia</p>
        </div>
      </div>
      <div className="ml-10 rounded-xl bg-white/90 px-3 py-2 text-[11px] text-stone-600 shadow ring-1 ring-stone-200">
        👀 blocco il prezzo fisso oggi
      </div>
    </div>
  );
}

function PriceListVisual({ pun }: { pun: number }) {
  const base = pun / 1000;
  const offers = [
    { n: "Luce Index Casa", s: 0.012 },
    { n: "Luce Index Business", s: 0.009 },
    { n: "Luce Index Green", s: 0.018 },
  ];
  return (
    <div className="mx-auto w-full max-w-xs overflow-hidden rounded-xl bg-white text-stone-900 shadow-lg ring-1 ring-stone-200">
      <div className="flex items-center justify-between bg-stone-900 px-3 py-1.5 text-[10px] font-bold text-white">
        <span>LISTINO · aggiornato 07:00</span>
        <span className="text-amber-300">PUN {fmt(base, 5)}</span>
      </div>
      {offers.map((o) => (
        <div key={o.n} className="flex items-center justify-between border-t border-stone-100 px-3 py-1.5 text-[11px]">
          <span className="font-semibold">{o.n}</span>
          <span className="font-mono tabular-nums">
            <span className="text-stone-400">+{fmt(o.s, 3)} = </span>
            <strong>{fmt(base + o.s, 4)}</strong>
          </span>
        </div>
      ))}
      <div className="border-t border-stone-100 bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700">
        Spread sotto la mediana di mercato (0,0165)
      </div>
    </div>
  );
}

function AiVisual({ pun }: { pun: number }) {
  return (
    <div className="mx-auto w-full max-w-xs space-y-2 text-xs">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-violet-600 px-3 py-2 text-white shadow">
        Quanto costa oggi l&apos;energia all&apos;ingrosso?
      </div>
      <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-stone-800 shadow ring-1 ring-stone-200">
        Il PUN di oggi e&apos; <strong>{fmt(pun)} €/MWh</strong>, cioe&apos; circa {fmt(pun / 1000, 3)} €/kWh.
        <div className="mt-1 text-[10px] text-stone-400">Fonte: Energy Index · energyindex.it</div>
      </div>
      <div className="flex items-center gap-1 font-mono text-[10px] text-stone-400">
        <Bot className="size-3" /> tool call → GET /api/v1/pun/today
      </div>
    </div>
  );
}

function ForecastVisual() {
  // Banda P10–P90 che si allarga con l'orizzonte, linea P50 in mezzo.
  const n = 30;
  const p50 = Array.from({ length: n }, (_, i) => 60 - Math.sin(i / 5) * 8 - i * 0.4);
  const spread = (i: number) => 4 + i * 0.7;
  const x = (i: number) => (i / (n - 1)) * 280 + 10;
  const top = p50.map((v, i) => `${x(i)},${v - spread(i)}`).join(" ");
  const bottom = p50.map((v, i) => `${x(i)},${v + spread(i)}`).reverse().join(" ");
  const line = p50.map((v, i) => `${x(i)},${v}`).join(" ");
  return (
    <div className="mx-auto w-full max-w-xs rounded-xl bg-white p-3 text-stone-900 shadow-lg ring-1 ring-stone-200">
      <div className="flex items-center justify-between text-[10px] font-bold">
        <span className="text-stone-500">Forecast PUN · 90 giorni</span>
        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-700">P10–P90</span>
      </div>
      <svg viewBox="0 0 300 100" className="mt-2 h-24 w-full" aria-hidden>
        <polygon points={`${top} ${bottom}`} className="fill-violet-500/15" />
        <polyline points={line} fill="none" strokeWidth={2.5} className="stroke-violet-600" />
        <line x1={10} x2={290} y1={88} y2={88} className="stroke-stone-200" />
      </svg>
      <div className="flex justify-between text-[10px] text-stone-500">
        <span>Ott</span><span>Nov</span><span>Dic</span>
      </div>
    </div>
  );
}

function CalculatorVisual() {
  return (
    <div className="mx-auto w-full max-w-xs rounded-xl bg-white p-3 text-stone-900 shadow-lg ring-1 ring-stone-200">
      <div className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Quanto spendi di luce?</div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 rounded-md border border-stone-300 px-2 py-1 font-mono text-sm">2.700</div>
        <span className="text-xs text-stone-500">kWh/anno</span>
      </div>
      <div className="mt-3 flex items-end justify-between rounded-lg bg-emerald-50 p-2">
        <div>
          <div className="text-[10px] text-emerald-700">Materia energia</div>
          <div className="font-mono text-xl font-black text-emerald-700">30,43 €<span className="text-xs font-bold">/mese</span></div>
        </div>
        <span className="text-[10px] font-semibold text-emerald-700 underline">Confronta offerte →</span>
      </div>
    </div>
  );
}

export function UseCases({ pun, psv }: { pun: number | null; psv: number | null }) {
  const p = pun ?? 118.73;
  const g = psv ?? 39.02;

  const cases: UseCase[] = [
    {
      id: "widget",
      icon: Globe,
      title: "Il prezzo dell'energia sul tuo sito",
      who: "Blog, testate, siti di consumatori",
      description: "Un riquadro con PUN e PSV del giorno, aggiornato da solo. Una chiamata, zero manutenzione.",
      tier: "open",
      endpoints: ["GET /today"],
      visual: <WidgetVisual pun={p} psv={g} />,
    },
    {
      id: "sheets",
      icon: Sheet,
      title: "Il PUN dentro Excel e Google Sheets",
      who: "Amministrazione, controllo di gestione",
      description: "Una formula e lo storico arriva nel foglio: verifiche bollette, budget e report senza copia-incolla.",
      tier: "developer",
      endpoints: ["GET /prices/pun/series?format=csv"],
      visual: <SheetsVisual />,
    },
    {
      id: "hourly",
      icon: Home,
      title: "Consumi spostati nelle ore meno care",
      who: "Domotica, colonnine EV, pompe di calore",
      description: "Home Assistant o il tuo gestionale leggono il PUN orario e accendono i carichi nelle ore piu' economiche.",
      tier: "api",
      endpoints: ["GET /pun/hourly?zone=nord"],
      visual: <HourlyVisual />,
    },
    {
      id: "alert",
      icon: BellRing,
      title: "Alert su Slack, Teams o Telegram",
      who: "Uffici acquisti, energy manager",
      description: "Una soglia e un webhook: quando il PSV la supera il team lo sa subito, senza guardare grafici.",
      tier: "api",
      endpoints: ["POST /alerts"],
      visual: <AlertVisual psv={g} />,
    },
    {
      id: "listini",
      icon: Tags,
      title: "Listini indicizzati sempre aggiornati",
      who: "Fornitori, broker, agenzie",
      description: "Ogni mattina il listino si ricalcola su PUN + spread e si confronta con la mediana del mercato libero.",
      tier: "api",
      endpoints: ["GET /pun/today", "GET /mercato-libero/stats"],
      visual: <PriceListVisual pun={p} />,
    },
    {
      id: "ai",
      icon: Bot,
      title: "Assistenti AI con dati veri",
      who: "Chatbot, agenti AI, CRM",
      description: "Dai al tuo agente una fonte ufficiale: risponde con il prezzo del giorno e la cita, invece di inventarlo.",
      tier: "open",
      endpoints: ["GET /pun/today", "openapi.json"],
      visual: <AiVisual pun={p} />,
    },
    {
      id: "forecast",
      icon: Factory,
      title: "Budget energia per la produzione",
      who: "PMI energivore, CFO",
      description: "La curva prevista a 90 giorni con banda di confidenza, per decidere quando fissare il prezzo.",
      tier: "api",
      endpoints: ["GET /forecast/pun?horizon=90"],
      visual: <ForecastVisual />,
    },
    {
      id: "calcolatore",
      icon: Calculator,
      title: "Calcolatore bolletta in un articolo",
      who: "Editori, comparatori, CAF",
      description: "L'utente inserisce il consumo e vede la spesa stimata con i prezzi di oggi.",
      tier: "open",
      endpoints: ["GET /tools/bill-estimate"],
      visual: <CalculatorVisual />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {cases.map((c) => {
        const Icon = c.icon;
        return (
          <article
            key={c.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div
              className={cn(
                "relative flex min-h-52 items-center justify-center bg-gradient-to-br to-transparent p-6",
                TIER_STYLE[c.tier].glow,
              )}
            >
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:14px_14px]"
              />
              <div className="relative w-full">{c.visual}</div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={cn("flex size-9 items-center justify-center rounded-xl bg-muted", TIER_STYLE[c.tier].text)}>
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold leading-tight">{c.title}</h3>
                    <p className="text-xs text-muted-foreground">{c.who}</p>
                  </div>
                </div>
                <TierBadge tier={c.tier} />
              </div>
              <p className="text-sm text-muted-foreground">{c.description}</p>
              <div className="mt-auto flex flex-wrap gap-1.5">
                {c.endpoints.map((e) => (
                  <code key={e} className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground/80">
                    {e}
                  </code>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
