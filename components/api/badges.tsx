import { cn } from "@/lib/utils";
import type { EndpointStatus, HttpMethod, TierId } from "@/lib/api/catalog";

/**
 * Badge condivisi tra /it/api e /it/api/docs. Ogni piano ha un colore
 * fisso, cosi' l'utente associa a colpo d'occhio endpoint e piano.
 */

export const TIER_STYLE: Record<
  TierId,
  { badge: string; ring: string; glow: string; text: string; dot: string }
> = {
  open: {
    badge: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
    ring: "ring-emerald-500/40",
    glow: "from-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  developer: {
    badge: "bg-sky-500/12 text-sky-700 ring-sky-500/30 dark:text-sky-300",
    ring: "ring-sky-500/40",
    glow: "from-sky-500/20",
    text: "text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  api: {
    badge: "bg-violet-500/12 text-violet-700 ring-violet-500/30 dark:text-violet-300",
    ring: "ring-violet-500/50",
    glow: "from-violet-500/25",
    text: "text-violet-600 dark:text-violet-400",
    dot: "bg-violet-500",
  },
  pro: {
    badge: "bg-amber-400/15 text-amber-800 ring-amber-500/35 dark:text-amber-300",
    ring: "ring-amber-500/40",
    glow: "from-amber-400/20",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  trading: {
    badge: "bg-orange-500/12 text-orange-700 ring-orange-500/30 dark:text-orange-300",
    ring: "ring-orange-500/40",
    glow: "from-orange-500/20",
    text: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  enterprise: {
    badge: "bg-stone-500/12 text-stone-700 ring-stone-500/30 dark:text-stone-300",
    ring: "ring-stone-500/40",
    glow: "from-stone-500/20",
    text: "text-stone-600 dark:text-stone-300",
    dot: "bg-stone-500",
  },
};

const TIER_LABEL: Record<TierId, string> = {
  open: "Open · gratis",
  developer: "Developer · gratis",
  api: "API · 99 €",
  pro: "Pro",
  trading: "Trading",
  enterprise: "Enterprise",
};

export function TierBadge({ tier, className }: { tier: TierId; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ring-1 whitespace-nowrap",
        TIER_STYLE[tier].badge,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", TIER_STYLE[tier].dot)} />
      {TIER_LABEL[tier]}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: EndpointStatus; className?: string }) {
  if (status === "live") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white whitespace-nowrap",
          className,
        )}
      >
        <span aria-hidden className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-white" />
        </span>
        Live
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground ring-1 ring-border whitespace-nowrap",
        className,
      )}
    >
      In arrivo
    </span>
  );
}

const METHOD_STYLE: Record<HttpMethod, string> = {
  GET: "bg-sky-600 text-white",
  POST: "bg-violet-600 text-white",
  DELETE: "bg-rose-600 text-white",
};

export function MethodBadge({ method, className }: { method: HttpMethod; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-black tracking-wider",
        METHOD_STYLE[method],
        className,
      )}
    >
      {method}
    </span>
  );
}
