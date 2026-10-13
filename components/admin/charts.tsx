import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyPoint, TopRow } from "@/lib/admin/queries";

/**
 * Grafici della dashboard admin in HTML/CSS puro (server component, zero
 * JS): una sola serie per grafico, quindi un solo colore e nessuna legenda;
 * il titolo del pannello dice cosa si sta guardando.
 */

const nf = new Intl.NumberFormat("it-IT");
export const fmtInt = (n: number) => nf.format(n);

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "mai";
  const min = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `${min} min fa`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h fa`;
  return `${Math.round(h / 24)} giorni fa`;
}

const dayLabel = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);

export function Panel({
  title,
  subtitle,
  children,
  className,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <span>{message}</span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Barre verticali per giorno, con valore al passaggio del mouse. */
export function DailyBars({ points, unit = "richieste" }: { points: DailyPoint[]; unit?: string }) {
  const max = Math.max(1, ...points.map((p) => p.requests));
  const total = points.reduce((s, p) => s + p.requests, 0);
  if (total === 0) return <Empty>Nessun dato nel periodo.</Empty>;
  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return (
    <div>
      <div className="flex items-end justify-between text-[11px] text-muted-foreground">
        <span>max {fmtInt(max)}</span>
      </div>
      <div className="relative mt-1 flex h-40 items-end gap-[2px] border-b border-border" role="img" aria-label={`Andamento giornaliero, totale ${fmtInt(total)} ${unit}`}>
        {points.map((p) => (
          <div key={p.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px] bg-violet-500 transition-colors group-hover:bg-violet-700 dark:bg-violet-400 dark:group-hover:bg-violet-300"
              style={{ height: `${(p.requests / max) * 100}%`, minHeight: p.requests > 0 ? 2 : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] text-background shadow group-hover:block">
              <strong>{dayLabel(p.day)}</strong> · {fmtInt(p.requests)} {unit}
              {p.uniques > 0 && <> · {fmtInt(p.uniques)} unici</>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        {ticks.map((i) => (
          <span key={i}>{dayLabel(points[i].day)}</span>
        ))}
      </div>
    </div>
  );
}

/** Classifica con barra orizzontale proporzionale e valori sempre visibili. */
export function TopList({
  rows,
  empty = "Nessun dato nel periodo.",
  mono = false,
  showUniques = true,
  showLastSeen = false,
  labelMap,
}: {
  rows: TopRow[];
  empty?: string;
  mono?: boolean;
  showUniques?: boolean;
  showLastSeen?: boolean;
  labelMap?: Record<string, string>;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  const max = Math.max(1, ...rows.map((r) => r.requests));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn("min-w-0 truncate", mono && "font-mono text-xs")} title={r.label}>
              {labelMap?.[r.label] ?? r.label}
            </span>
            <span className="shrink-0 tabular-nums">
              <strong>{fmtInt(r.requests)}</strong>
              {showUniques && <span className="text-xs text-muted-foreground"> · {fmtInt(r.uniques)} unici</span>}
              {showLastSeen && <span className="text-xs text-muted-foreground"> · {fmtAgo(r.last_seen)}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-violet-500 dark:bg-violet-400" style={{ width: `${(r.requests / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Kpi({
  label,
  value,
  delta,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  delta?: number | null;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4",
        tone === "warn" && "border-amber-500/50",
        tone === "bad" && "border-rose-500/50",
      )}
    >
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-3xl font-black tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {delta !== undefined && delta !== null && (
          <span className={cn("mr-1 font-bold", delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {hint}
      </p>
    </div>
  );
}

/** Variazione percentuale; null se il periodo precedente e' zero. */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
