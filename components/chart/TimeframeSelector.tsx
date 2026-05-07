import Link from "next/link";
import { TIMEFRAMES, type TimeframeId } from "@/lib/timeframes";
import { cn } from "@/lib/utils";

export function TimeframeSelector({
  active,
  basePath,
}: {
  active: TimeframeId;
  basePath: string;
}) {
  return (
    <nav
      aria-label="Periodo"
      className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card/40 p-1"
    >
      {TIMEFRAMES.map((t) => {
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={`${basePath}?tf=${t.id}`}
            scroll={false}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
