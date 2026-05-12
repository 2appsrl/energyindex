import Link from "next/link";
import { PUN_ZONES, type ZoneCode } from "@/lib/pun-zones";
import { cn } from "@/lib/utils";

export function ZoneSelector({
  active,
  basePath,
  preserveTf,
}: {
  active: ZoneCode;
  basePath: string;
  /** Se presente, viene preservato come query param affianco a ?zone= */
  preserveTf?: string | null;
}) {
  return (
    <nav
      aria-label="Zona PUN"
      className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card/40 p-1"
    >
      {PUN_ZONES.map((z) => {
        const isActive = z.code === active;
        const params = new URLSearchParams();
        // Nazionale = niente param (URL pulita).
        if (!z.isNational) params.set("zone", z.code);
        if (preserveTf) params.set("tf", preserveTf);
        const qs = params.toString();
        const href = qs ? `${basePath}?${qs}` : basePath;
        return (
          <Link
            key={z.code}
            href={href}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {z.displayShort}
          </Link>
        );
      })}
    </nav>
  );
}
