import { ImageResponse } from "next/og";
import { createServerClient } from "@/lib/supabase/server";

export const alt = "Energy Index — Mercato Libero offerte ARERA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

// Brand palette (cfr. public/brand/README.md).
const DEEP_FOREST = "#0a3d2e";
const SIGNAL_GREEN = "#16a34a";
const WHITE = "#ffffff";
const MUTED = "rgba(255,255,255,0.72)";

const NUMBER_4DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

interface AggregateRow {
  aggregate_slug: string;
  median: number | string;
  sample_size: number;
  unit: string;
  computed_at: string;
}

export default async function Image() {
  let total = 0;
  let luce: { median: number; unit: string } | null = null;
  let gas: { median: number; unit: string } | null = null;

  try {
    const supabase = await createServerClient();
    const { data: latest } = await supabase
      .from("energy_index_aggregates")
      .select("aggregate_slug, median, sample_size, computed_at, unit")
      .order("computed_at", { ascending: false });

    const seen = new Set<string>();
    for (const r of (latest ?? []) as AggregateRow[]) {
      if (seen.has(r.aggregate_slug)) continue;
      seen.add(r.aggregate_slug);
      total += Number(r.sample_size ?? 0);
      if (r.aggregate_slug === "mercato-libero-luce-fissa" && !luce) {
        luce = { median: Number(r.median), unit: r.unit };
      }
      if (r.aggregate_slug === "mercato-libero-gas-fissa" && !gas) {
        gas = { median: Number(r.median), unit: r.unit };
      }
      if (seen.size >= 4) break;
    }
  } catch {
    // fallback brand-only senza statistiche
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: DEEP_FOREST,
          display: "flex",
          color: WHITE,
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 24,
            background: SIGNAL_GREEN,
            height: "100%",
            display: "flex",
          }}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "70px 80px",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontFamily: "'SF Mono', Menlo, Consolas, monospace",
              fontWeight: 500,
              letterSpacing: 5,
              color: WHITE,
              display: "flex",
            }}
          >
            EIDX · ENERGY INDEX
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              marginTop: 36,
              lineHeight: 1.05,
              color: WHITE,
              letterSpacing: -1,
              display: "flex",
            }}
          >
            Mercato Libero
          </div>
          <div
            style={{
              fontSize: 30,
              color: MUTED,
              marginTop: 14,
              display: "flex",
            }}
          >
            {total > 0
              ? `${total} offerte PLACET · ARERA · aggiornate ogni giorno`
              : "Osservatorio offerte PLACET · ARERA"}
          </div>
          <div style={{ display: "flex", gap: 64, marginTop: 60 }}>
            {luce && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    fontSize: 22,
                    color: SIGNAL_GREEN,
                    fontWeight: 700,
                    letterSpacing: 2,
                    display: "flex",
                  }}
                >
                  LUCE FISSA · mediana
                </div>
                <div
                  style={{
                    fontSize: 60,
                    color: WHITE,
                    fontWeight: 800,
                    marginTop: 6,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                  }}
                >
                  <span>{NUMBER_4DP.format(luce.median)}</span>
                  <span style={{ fontSize: 28, color: MUTED }}>
                    {luce.unit}
                  </span>
                </div>
              </div>
            )}
            {gas && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    fontSize: 22,
                    color: SIGNAL_GREEN,
                    fontWeight: 700,
                    letterSpacing: 2,
                    display: "flex",
                  }}
                >
                  GAS FISSO · mediana
                </div>
                <div
                  style={{
                    fontSize: 60,
                    color: WHITE,
                    fontWeight: 800,
                    marginTop: 6,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                  }}
                >
                  <span>{NUMBER_4DP.format(gas.median)}</span>
                  <span style={{ fontSize: 28, color: MUTED }}>
                    {gas.unit}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 60,
              right: 80,
              fontSize: 24,
              color: SIGNAL_GREEN,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <svg width="26" height="26" viewBox="0 0 28 28">
              <polyline
                points="6,18 14,8 22,18"
                fill="none"
                stroke={SIGNAL_GREEN}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>energyindex.it/mercato-libero</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
