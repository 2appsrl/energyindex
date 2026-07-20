"use client";

import Link from "next/link";
import { type ZoneCode } from "@/lib/pun-zones";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

// Path SVG stilizzati (viewBox 200x280). Non precisi geograficamente:
// rappresentazione schematica con stivale + 2 isole, suddiviso in 4 bande
// orizzontali (Nord, CNor, CSud, Sud) + 2 ovali per le isole.
const ZONE_SHAPES: Record<Exclude<ZoneCode, "nazionale">, { d: string; cx: number; cy: number; label: string }> = {
  nord: {
    d: "M 50 30 L 150 30 L 160 70 L 145 80 L 55 80 L 40 70 Z",
    cx: 100, cy: 55, label: "NORD",
  },
  cnor: {
    d: "M 55 80 L 145 80 L 140 110 L 90 115 L 60 110 Z",
    cx: 100, cy: 97, label: "C-NORD",
  },
  csud: {
    d: "M 60 110 L 140 110 L 145 150 L 95 158 L 70 150 Z",
    cx: 102, cy: 132, label: "C-SUD",
  },
  sud: {
    d: "M 70 150 L 145 150 L 130 200 L 105 220 L 90 215 L 80 195 Z",
    cx: 105, cy: 180, label: "SUD",
  },
  sici: {
    d: "M 50 235 L 105 235 L 110 260 L 60 262 L 40 250 Z",
    cx: 75, cy: 248, label: "SIC",
  },
  sard: {
    d: "M 15 130 L 40 130 L 45 180 L 35 200 L 18 195 L 10 175 Z",
    cx: 28, cy: 165, label: "SAR",
  },
};

export function ZoneMapItalia({
  active,
  basePath,
  preserveTf,
}: {
  active: ZoneCode;
  basePath: string;
  preserveTf?: string | null;
}) {
  const buildHref = (code: ZoneCode) => {
    const params = new URLSearchParams();
    if (code !== "nazionale") params.set("zone", code);
    if (preserveTf) params.set("tf", preserveTf);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="0 0 200 280"
        className="h-72 w-auto"
        role="img"
        aria-label="Mappa Italia con zone PUN cliccabili"
      >
        {(Object.entries(ZONE_SHAPES) as Array<[Exclude<ZoneCode, "nazionale">, typeof ZONE_SHAPES[keyof typeof ZONE_SHAPES]]>).map(
          ([code, shape]) => {
            const isActive = code === active;
            return (
              <Link
                key={code}
                href={buildHref(code)}
                scroll={false}
                aria-label={`Vai a zona ${shape.label}`}
                onClick={() => {
                  if (!isActive) trackEvent("zone_change", { zone: code, via: "map" });
                }}
              >
                <g className="group cursor-pointer">
                  <path
                    d={shape.d}
                    className={cn(
                      "transition-colors stroke-2",
                      isActive
                        ? "fill-primary stroke-primary"
                        : "fill-muted/50 stroke-border group-hover:fill-primary/20 group-hover:stroke-primary/60",
                    )}
                  />
                  <text
                    x={shape.cx}
                    y={shape.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={cn(
                      "pointer-events-none text-[10px] font-semibold select-none",
                      isActive ? "fill-primary-foreground" : "fill-muted-foreground",
                    )}
                  >
                    {shape.label}
                  </text>
                </g>
              </Link>
            );
          },
        )}
      </svg>
      {/* Link "Vista nazionale" sotto la mappa (l'Italia intera non è uno shape cliccabile) */}
      {active !== "nazionale" && (
        <Link
          href={buildHref("nazionale")}
          scroll={false}
          onClick={() => trackEvent("zone_change", { zone: "nazionale", via: "map_back" })}
          className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
        >
          ← Torna a vista nazionale
        </Link>
      )}
    </div>
  );
}
