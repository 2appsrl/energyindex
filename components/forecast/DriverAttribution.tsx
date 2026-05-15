import { cn } from "@/lib/utils";

export interface DriverItem {
  name: string;
  label: string;
  contribution: number;
  direction: "up" | "down";
}

export function DriverAttribution({
  drivers,
  unit,
}: {
  drivers: DriverItem[];
  unit: string;
}) {
  if (drivers.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">Driver principali</h3>
      <ul className="space-y-1.5">
        {drivers.map((d) => (
          <li key={d.name} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "inline-block w-4 text-center font-bold tabular-nums",
                  d.direction === "up" ? "text-rose-500" : "text-emerald-500",
                )}
              >
                {d.direction === "up" ? "▲" : "▼"}
              </span>
              <span>{d.label}</span>
            </span>
            <span className="font-medium tabular-nums">
              {d.direction === "up" ? "+" : "−"}
              {Math.abs(d.contribution).toFixed(2)} {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
