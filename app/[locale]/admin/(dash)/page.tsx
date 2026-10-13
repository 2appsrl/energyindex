import Link from "next/link";
import { Activity, Bot, Database, Inbox, LayoutDashboard, LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import {
  assetFreshness,
  cronStatus,
  etlStatus,
  fillDays,
  listLeads,
  newApiConsumers,
  sumLast,
  trafficDaily,
  trafficTop,
  type AssetFreshness,
} from "@/lib/admin/queries";
import { AGENT_KIND_LABELS } from "@/lib/traffic/classify";
import { adminLogout } from "@/app/actions/admin-auth";
import {
  DailyBars,
  Empty,
  ErrorNote,
  Kpi,
  Panel,
  TopList,
  fmtAgo,
  fmtDateTime,
  fmtInt,
  pctDelta,
} from "@/components/admin/charts";
import { LeadStatusForm } from "@/components/admin/LeadStatusForm";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "panoramica", label: "Panoramica", icon: LayoutDashboard },
  { id: "api", label: "API", icon: Activity },
  { id: "bot", label: "Bot e AI", icon: Bot },
  { id: "lead", label: "Lead", icon: Inbox },
  { id: "dati", label: "Salute dati", icon: Database },
] as const;
type TabId = (typeof TABS)[number]["id"];

const RANGES = [7, 30, 90] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; giorni?: string }>;
}) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const tab: TabId = TABS.some((t) => t.id === sp.tab) ? (sp.tab as TabId) : "panoramica";
  const days = RANGES.find((r) => String(r) === sp.giorni) ?? 30;
  const href = (t: TabId, d = days) => `/it/admin?tab=${t}&giorni=${d}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Admin</p>
          <h1 className="text-3xl font-black tracking-tight">Cosa succede su Energy Index</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{user.email}</span>
          <form action={adminLogout}>
            <button className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold hover:bg-muted">
              <LogOut className="size-4" /> Esci
            </button>
          </form>
        </div>
      </header>

      <nav className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={href(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                t.id === tab ? "bg-violet-600 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </Link>
          ))}
        </div>
        {tab !== "lead" && tab !== "dati" && (
          <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs font-bold">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={href(tab, r)}
                className={cn("rounded-md px-2.5 py-1", r === days ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                {r} giorni
              </Link>
            ))}
          </div>
        )}
      </nav>

      {tab === "panoramica" && <Overview days={days} />}
      {tab === "api" && <ApiTab days={days} />}
      {tab === "bot" && <BotTab days={days} />}
      {tab === "lead" && <LeadTab />}
      {tab === "dati" && <DataTab />}
    </div>
  );
}

// ============================================================ PANORAMICA

async function Overview({ days }: { days: number }) {
  // Serie da 2×7 giorni per confrontare l'ultima settimana con la precedente.
  const span = Math.max(days, 14);
  const [api, ai, consumers, leads, fresh] = await Promise.all([
    trafficDaily("api", span),
    trafficDaily("bot", span, "ai"),
    trafficTop("api", "consumer", 7, 1000),
    listLeads("nuovo"),
    assetFreshness(),
  ]);

  const apiSeries = api.data ? fillDays(api.data, span) : null;
  const aiSeries = ai.data ? fillDays(ai.data, span) : null;
  const stale = fresh.data?.filter((a) => freshness(a).tone !== "good").length ?? null;

  return (
    <div className="space-y-6">
      {api.error && <ErrorNote message={api.error} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          label="Chiamate API · 7 giorni"
          value={apiSeries ? fmtInt(sumLast(apiSeries, 7)) : "—"}
          delta={apiSeries ? pctDelta(sumLast(apiSeries, 7), sumLast(apiSeries, 7, 7)) : null}
          hint="vs 7 giorni prima"
        />
        <Kpi label="Consumatori API · 7 giorni" value={consumers.data ? fmtInt(consumers.data.length) : "—"} hint="siti, app e script distinti" />
        <Kpi
          label="Visite crawler AI · 7 giorni"
          value={aiSeries ? fmtInt(sumLast(aiSeries, 7)) : "—"}
          delta={aiSeries ? pctDelta(sumLast(aiSeries, 7), sumLast(aiSeries, 7, 7)) : null}
          hint="vs 7 giorni prima"
        />
        <Kpi
          label="Lead da lavorare"
          value={leads.data ? fmtInt(leads.data.length) : "—"}
          tone={leads.data && leads.data.length > 0 ? "warn" : "neutral"}
          hint="stato 'nuovo'"
        />
        <Kpi
          label="Dati in ritardo"
          value={stale === null ? "—" : fmtInt(stale)}
          tone={stale ? "bad" : "good"}
          hint={stale ? "vedi Salute dati" : "tutto aggiornato"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Chiamate API al giorno" subtitle={`Ultimi ${days} giorni`}>
          {apiSeries ? <DailyBars points={apiSeries.slice(-days)} /> : <Empty>—</Empty>}
        </Panel>
        <Panel title="Visite dei crawler AI al giorno" subtitle="GPTBot, ClaudeBot, PerplexityBot e simili">
          {aiSeries ? <DailyBars points={aiSeries.slice(-days)} unit="visite" /> : <Empty>—</Empty>}
        </Panel>
      </div>
    </div>
  );
}

// ============================================================ API

async function ApiTab({ days }: { days: number }) {
  const [daily, consumers, paths, agents, countries, fresh] = await Promise.all([
    trafficDaily("api", days),
    trafficTop("api", "consumer", days, 15),
    trafficTop("api", "path", days, 15),
    trafficTop("api", "agent", days, 10),
    trafficTop("api", "country", days, 10),
    newApiConsumers(7),
  ]);
  if (daily.data === null) return <ErrorNote message={daily.error} />;

  return (
    <div className="space-y-4">
      <Panel title="Chiamate al giorno" subtitle="Incluse quelle servite dalla cache CDN">
        <DailyBars points={fillDays(daily.data, days)} />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Chi usa le API" subtitle="Chiave, sito chiamante, referer, oppure tipo di client + impronta giornaliera">
          <TopList rows={consumers.data ?? []} mono showLastSeen />
        </Panel>
        <Panel title="Nuovi consumatori" subtitle="Comparsi per la prima volta negli ultimi 7 giorni">
          {fresh.data && fresh.data.length > 0 ? (
            <ul className="divide-y text-sm">
              {fresh.data.map((c) => (
                <li key={c.consumer} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 truncate font-mono text-xs" title={c.consumer}>{c.consumer}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {c.agent} · {fmtInt(c.requests)} chiamate · dal {fmtDateTime(c.first_seen)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nessun nuovo consumatore questa settimana.</Empty>
          )}
        </Panel>
        <Panel title="Endpoint piu' chiamati">
          <TopList rows={paths.data ?? []} mono />
        </Panel>
        <div className="grid gap-4">
          <Panel title="Client">
            <TopList rows={agents.data ?? []} />
          </Panel>
          <Panel title="Paesi">
            <TopList rows={countries.data ?? []} empty="Paese non disponibile (solo in produzione su Netlify)." />
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ============================================================ BOT

async function BotTab({ days }: { days: number }) {
  const [daily, kinds, aiAgents, aiPaths, searchAgents, searchPaths] = await Promise.all([
    trafficDaily("bot", days, "ai"),
    trafficTop("bot", "agent_kind", days, 10),
    trafficTop("bot", "agent", days, 15, "ai"),
    trafficTop("bot", "path", days, 15, "ai"),
    trafficTop("bot", "agent", days, 10, "search"),
    trafficTop("bot", "path", days, 10, "search"),
  ]);
  if (daily.data === null) return <ErrorNote message={daily.error} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel title="Visite dei crawler AI al giorno">
          <DailyBars points={fillDays(daily.data, days)} unit="visite" />
        </Panel>
        <Panel title="Bot per famiglia">
          <TopList rows={kinds.data ?? []} showUniques={false} labelMap={AGENT_KIND_LABELS} />
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Crawler AI" subtitle="Chi legge il sito per rispondere nelle chat AI">
          <TopList rows={aiAgents.data ?? []} showUniques={false} showLastSeen />
        </Panel>
        <Panel title="Pagine lette dai crawler AI">
          <TopList rows={aiPaths.data ?? []} mono showUniques={false} />
        </Panel>
        <Panel title="Motori di ricerca">
          <TopList rows={searchAgents.data ?? []} showUniques={false} showLastSeen />
        </Panel>
        <Panel title="Pagine lette dai motori di ricerca">
          <TopList rows={searchPaths.data ?? []} mono showUniques={false} />
        </Panel>
      </div>
    </div>
  );
}

// ============================================================ LEAD

const SOURCE_LABEL = { api_key: "Chiave API", contact: "Contatto" } as const;

async function LeadTab() {
  const leads = await listLeads();
  if (leads.data === null) return <ErrorNote message={leads.error} />;
  if (leads.data.length === 0) {
    return (
      <Panel title="Lead">
        <Empty>Ancora nessun lead. Arrivano dal form chiave di /it/api e dal form contatti di /it/pro.</Empty>
      </Panel>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="p-3">Quando</th>
            <th className="p-3">Chi</th>
            <th className="p-3">Richiesta</th>
            <th className="w-56 p-3">Stato e note</th>
          </tr>
        </thead>
        <tbody>
          {leads.data.map((l) => (
            <tr key={l.id} className="border-t align-top">
              <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                {fmtDateTime(l.created_at)}
                <span className="mt-1 block w-fit rounded bg-muted px-1.5 py-0.5 font-bold">{SOURCE_LABEL[l.source]}</span>
              </td>
              <td className="p-3">
                <div className="font-semibold">{l.nome ?? "—"}</div>
                <a href={`mailto:${l.email}`} className="text-xs text-violet-700 underline dark:text-violet-400">{l.email}</a>
                {l.azienda && <div className="text-xs text-muted-foreground">{l.azienda}</div>}
              </td>
              <td className="p-3">
                {(l.piano || l.oggetto) && <div className="text-xs font-bold">{l.piano ? `Piano: ${l.piano}` : l.oggetto}</div>}
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">{l.messaggio}</p>
              </td>
              <td className="p-3">
                <LeadStatusForm id={l.id} status={l.status} notes={l.notes} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================ SALUTE DATI

function freshness(a: AssetFreshness): { tone: "good" | "warn" | "bad"; label: string } {
  // Soglie in giorni: i mercati non pubblicano nel weekend, quindi 2 giorni
  // di ritardo sono normali, oltre 4 qualcosa si e' rotto.
  const age = (Date.now() - new Date(a.observed_at).getTime()) / 86_400_000;
  if (age <= 2.5) return { tone: "good", label: "Aggiornato" };
  if (age <= 4.5) return { tone: "warn", label: "In ritardo" };
  return { tone: "bad", label: "Fermo" };
}

const TONE = {
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  bad: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};
const TONE_ICON = { good: "●", warn: "▲", bad: "■" };

async function DataTab() {
  const [fresh, etl, cron] = await Promise.all([assetFreshness(), etlStatus(), cronStatus()]);
  return (
    <div className="space-y-4">
      <Panel title="Ultimo dato per indice" subtitle="Data di mercato dell'ultima osservazione e quando e' stata scritta">
        {fresh.data === null ? (
          <ErrorNote message={fresh.error} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {fresh.data.map((a) => {
              const f = freshness(a);
              return (
                <div key={a.asset_slug} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{a.display_name_it ?? a.asset_slug}</div>
                    <div className="text-xs text-muted-foreground">
                      dato del {a.observed_at.slice(0, 10).split("-").reverse().join("/")} · scritto {fmtAgo(a.recorded_at)}
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", TONE[f.tone])}>
                    {TONE_ICON[f.tone]} {f.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Esecuzioni ETL" subtitle="Ultima esecuzione per fonte, dalla tabella etl_runs">
          {etl.data === null ? (
            <ErrorNote message={etl.error} />
          ) : etl.data.length === 0 ? (
            <Empty>Nessuna esecuzione registrata.</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {etl.data.map((r) => {
                const tone = r.status === "ok" ? "good" : r.status === "running" ? "warn" : "bad";
                return (
                  <li key={r.source} className="space-y-1 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-semibold">{r.source}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", TONE[tone])}>
                        {TONE_ICON[tone]} {r.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtAgo(r.started_at)} · {r.rows_ingested ?? 0} righe · {r.errors_7d}/{r.runs_7d} errori in 7 giorni
                    </div>
                    {r.error_message && <p className="text-xs text-rose-600 dark:text-rose-400">{r.error_message}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Job pianificati (pg_cron)">
          {cron.data === null ? (
            <ErrorNote message={cron.error} />
          ) : (
            <ul className="divide-y text-sm">
              {cron.data.map((j) => {
                const tone = !j.active ? "warn" : j.last_status === "failed" ? "bad" : "good";
                return (
                  <li key={j.jobname} className="space-y-1 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-semibold">{j.jobname}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", TONE[tone])}>
                        {TONE_ICON[tone]} {!j.active ? "disattivo" : (j.last_status ?? "mai eseguito")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <code>{j.schedule}</code> · ultima {fmtAgo(j.last_start)}
                    </div>
                    {j.last_status === "failed" && j.last_message && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">{j.last_message}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
      <p className="text-xs text-muted-foreground">
        Gli ETL che girano su GitHub Actions compaiono qui solo se scrivono in etl_runs; il loro effetto si vede comunque
        nel riquadro &quot;Ultimo dato per indice&quot;.
      </p>
    </div>
  );
}
