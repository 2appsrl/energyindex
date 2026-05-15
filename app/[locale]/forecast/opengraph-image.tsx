import { ImageResponse } from "next/og";
import { createServerClient } from "@/lib/supabase/server";

export const alt = "Energy Index — Previsioni PUN, PSV, TTF";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const DEEP_FOREST = "#0a3d2e";
const SIGNAL_GREEN = "#16a34a";
const WHITE = "#ffffff";
const MUTED = "rgba(255,255,255,0.72)";

const NUMBER_2DP = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function Image() {
  let cards: { name: string; value: string; unit: string }[] = [
    { name: "PUN", value: "—", unit: "€/MWh" },
    { name: "PSV", value: "—", unit: "€/MWh" },
    { name: "TTF", value: "—", unit: "€/MWh" },
  ];

  try {
    const supabase = await createServerClient();
    const { data } = await supabase.rpc("get_forecast_latest", {
      p_asset_slugs: ["pun", "psv", "ttf"],
      p_horizon_days: 30,
    });
    if (Array.isArray(data)) {
      cards = data.map((r: { asset_slug: string; value: number | string; unit: string }) => ({
        name: r.asset_slug.toUpperCase(),
        value: NUMBER_2DP.format(Number(r.value)),
        unit: r.unit,
      }));
    }
  } catch {
    // fallback brand-only senza prezzi
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: DEEP_FOREST,
          display: "flex",
          flexDirection: "column",
          color: WHITE,
          fontFamily: "system-ui, sans-serif",
          padding: 60,
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: SIGNAL_GREEN, fontWeight: 700, marginBottom: 8 }}>
          Energy Index — Forecast
        </div>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 800, lineHeight: 1.1, marginBottom: 48 }}>
          Previsione 30 giorni
        </div>
        <div style={{ display: "flex", gap: 48, flex: 1, alignItems: "center" }}>
          {cards.map((c) => (
            <div
              key={c.name}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 16,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", fontSize: 24, color: MUTED, fontWeight: 600 }}>{c.name}</div>
              <div style={{ display: "flex", fontSize: 56, fontWeight: 800, lineHeight: 1, color: WHITE }}>
                {c.value}
              </div>
              <div style={{ display: "flex", fontSize: 20, color: MUTED }}>{c.unit}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 18, color: MUTED, marginTop: 32 }}>
          energyindex.it/it/forecast — banda 5–95% + metodologia pubblica
        </div>
      </div>
    ),
    { ...size },
  );
}
