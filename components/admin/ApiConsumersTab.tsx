import { ExternalLink } from "lucide-react";
import { aggregateConsumers, type ConsumerKind } from "@/lib/admin/api-consumers";
import { consumerSources, identifiedApiCalls, trafficTop } from "@/lib/admin/queries";
import type { SourceStatus } from "@/lib/api-keys/source-check";
import { cn } from "@/lib/utils";
import { Empty, ErrorNote, Panel, TopList, fmtAgo, fmtDateTime, fmtInt } from "@/components/admin/charts";

const KIND_LABEL: Record<ConsumerKind, string> = { sito: "Sito", widget: "Widget", chiave: "Chiave" };

const SOURCE_BADGE: Record<SourceStatus, { label: string; tone: string }> = {
  link: { label: "Link presente", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  testo: { label: "Citata, senza link", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  assente: { label: "Non trovata", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-400" },
  errore: { label: "Sito non raggiungibile", tone: "bg-muted text-muted-foreground" },
};
const NOT_CHECKED = { label: "Da controllare", tone: "bg-muted text-muted-foreground" };

/** Chi sta usando le API: prima i siti riconoscibili, poi i programmi senza nome. */
export async function ApiConsumersTab({ days }: { days: number }) {
  const [calls, top, sources] = await Promise.all([
    identifiedApiCalls(days),
    trafficTop("api", "consumer", days, 40),
    consumerSources(),
  ]);
  if (calls.data === null) return <ErrorNote message={calls.error} />;

  const consumers = aggregateConsumers(calls.data.rows);
  // Se la tabella dei controlli manca, l'elenco dei siti resta comunque utile.
  const sourceBySite = new Map((sources.data ?? []).map((s) => [s.site, s]));
  // Le impronte "Java #abc" sono giornaliere: lo stesso programma puo' comparire una volta al giorno.
  const anonymous = (top.data ?? []).filter((r) => r.label.includes("#")).slice(0, 15);

  return (
    <div className="space-y-4">
      <Panel
        title={`Siti e chiavi che chiamano le API (${fmtInt(consumers.length)})`}
        subtitle={`Ultimi ${days} giorni. Il sito si riconosce quando la chiamata parte dal browser di un suo visitatore. Esclusi i nostri domini e le prove in locale.`}
      >
        {consumers.length === 0 ? (
          <Empty>Nessun sito riconoscibile in questo periodo.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Chi</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Fonte visibile</th>
                  <th className="py-2 pr-3 text-right font-medium">Chiamate</th>
                  <th className="py-2 pr-3 text-right font-medium">IP distinti</th>
                  <th className="py-2 pr-3 font-medium">Cosa legge</th>
                  <th className="py-2 pr-3 font-medium">Primo uso</th>
                  <th className="py-2 font-medium">Ultimo uso</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {consumers.map((c) => (
                  <tr key={c.name} className="align-top">
                    <td className="py-2 pr-3 font-medium">
                      {c.kind === "chiave" ? (
                        <span className="font-mono text-xs">{c.name}</span>
                      ) : (
                        <a
                          href={`https://${c.name}`}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1 underline underline-offset-2"
                        >
                          {c.name}
                          <ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden />
                        </a>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{KIND_LABEL[c.kind]}</td>
                    <td className="py-2 pr-3 text-xs">
                      {c.kind === "chiave" ? (
                        <span className="text-muted-foreground">Vedi Integrazioni</span>
                      ) : (
                        <SourceCell check={sourceBySite.get(c.name)} />
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtInt(c.requests)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtInt(c.visitors)}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {c.endpoints.map((e) => `${e.path} (${fmtInt(e.requests)})`).join(", ")}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{fmtDateTime(c.firstSeen)}</td>
                    <td className="py-2 text-xs text-muted-foreground">{fmtAgo(c.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Fonte visibile: ogni lunedi&apos; controlliamo l&apos;HTML della home di ogni sito. I siti che caricano la fonte
          via JavaScript, o che usano i dati su un&apos;altra pagina, possono risultare &quot;Non trovata&quot;: prima di
          scrivere a qualcuno controlla la pagina a mano.
        </p>
        {calls.data.truncated && (
          <p className="mt-2 text-xs text-muted-foreground">Mostrate solo le 10.000 chiamate piu&apos; recenti: riduci il periodo.</p>
        )}
      </Panel>

      <Panel
        title="Programmi senza nome"
        subtitle="Chiamate da server o script, che non dichiarano un sito: si vede solo il tipo di client e un'impronta che cambia ogni giorno."
      >
        <TopList rows={anonymous} mono showLastSeen empty="Nessun programma anonimo in questo periodo." />
      </Panel>
    </div>
  );
}

function SourceCell({ check }: { check?: { status: SourceStatus; checked_at: string } }) {
  const badge = check ? SOURCE_BADGE[check.status] : NOT_CHECKED;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className={cn("rounded-full px-2 py-0.5 font-medium", badge.tone)}>{badge.label}</span>
      {check && <span className="text-[11px] text-muted-foreground">{fmtDateTime(check.checked_at)}</span>}
    </div>
  );
}
