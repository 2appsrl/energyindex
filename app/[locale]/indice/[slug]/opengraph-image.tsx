import { ImageResponse } from "next/og";
import { createServerClient } from "@/lib/supabase/server";

export const alt = "Energy Index — Prezzo asset";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Cache OG per 1h (i prezzi orari aggiornano comunque a ogni revalidate).
export const revalidate = 3600;

// Brand palette (cfr. public/brand/README.md).
const DEEP_FOREST = "#0a3d2e";
const SIGNAL_GREEN = "#16a34a";
const WHITE = "#ffffff";
const MUTED = "rgba(255,255,255,0.72)";
const UP_RED = "#f43f5e";

const NUMBER_2DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;

  let displayName = slug.toUpperCase();
  let unit = "€/MWh";
  let value: number | null = null;
  let prev: number | null = null;

  try {
    const supabase = await createServerClient();
    const { data: meta } = await supabase
      .from("mv_latest_price_per_asset")
      .select("asset_id, display_name_it, unit")
      .eq("asset_slug", slug)
      .maybeSingle();
    if (meta) {
      displayName = (meta.display_name_it as string) || displayName;
      unit = (meta.unit as string) || unit;
      const { data: rows } = await supabase
        .from("price_observations")
        .select("value")
        .eq("asset_id", meta.asset_id)
        .lte("observed_at", new Date().toISOString())
        .order("observed_at", { ascending: false })
        .limit(2);
      if (rows?.[0]) value = Number(rows[0].value);
      if (rows?.[1]) prev = Number(rows[1].value);
    }
  } catch {
    // fallback brand-only senza prezzo
  }

  const deltaPct =
    value !== null && prev !== null && prev !== 0
      ? ((value - prev) / prev) * 100
      : null;
  // Prezzo in salita = rosso (rincaro), discesa = signal green (risparmio).
  const deltaColor =
    deltaPct !== null && deltaPct >= 0 ? UP_RED : SIGNAL_GREEN;
  const deltaSym = deltaPct !== null ? (deltaPct >= 0 ? "▲" : "▼") : "";

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
              fontSize: 46,
              fontWeight: 600,
              marginTop: 56,
              color: MUTED,
              display: "flex",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              marginTop: 24,
              gap: 28,
            }}
          >
            <div
              style={{
                fontSize: 132,
                fontWeight: 800,
                color: WHITE,
                letterSpacing: -3,
                lineHeight: 1,
                display: "flex",
              }}
            >
              {value !== null ? NUMBER_2DP.format(value) : "—"}
            </div>
            <div style={{ fontSize: 42, color: MUTED, display: "flex" }}>
              {unit}
            </div>
          </div>
          {deltaPct !== null && (
            <div
              style={{
                fontSize: 38,
                color: deltaColor,
                fontWeight: 700,
                marginTop: 20,
                display: "flex",
                gap: 12,
              }}
            >
              <span>{deltaSym}</span>
              <span>
                {Math.abs(deltaPct).toFixed(1)}% vs ora precedente
              </span>
            </div>
          )}
          <div
            style={{
              position: "absolute",
              bottom: 60,
              right: 80,
              fontSize: 26,
              color: SIGNAL_GREEN,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28">
              <polyline
                points="6,18 14,8 22,18"
                fill="none"
                stroke={SIGNAL_GREEN}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>energyindex.it</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
