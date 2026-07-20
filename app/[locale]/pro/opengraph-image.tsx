import { ImageResponse } from "next/og";

export const alt = "EIDX Pro — analytics professionali per il mercato energy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400; // 1 day — pagina statica, no live data

const DEEP_FOREST = "#0a3d2e";
const SIGNAL_GREEN = "#16a34a";
const AMBER = "#f59e0b";
const WHITE = "#ffffff";
const MUTED = "rgba(255,255,255,0.72)";

export default function Image() {
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
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(245, 158, 11, 0.15)",
              border: `1px solid ${AMBER}80`,
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: 18,
              fontWeight: 700,
              color: AMBER,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            In arrivo Q3 2026
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            color: SIGNAL_GREEN,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          EIDX Pro
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 32,
            maxWidth: 1000,
          }}
        >
          Analytics professionali per il mercato energy
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: MUTED,
            lineHeight: 1.4,
            maxWidth: 950,
            marginBottom: "auto",
          }}
        >
          Margin simulator, forecast 24 mesi con scenari, report PDF brandizzati. Per fornitori,
          broker e PMI energivore.
        </div>
        <div
          style={{
            display: "flex",
            gap: 32,
            paddingTop: 32,
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {[
            { label: "Free", price: "0€" },
            { label: "Pro", price: "149€/mese" },
            { label: "Enterprise", price: "3.500€/mese" },
          ].map((t) => (
            <div key={t.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ display: "flex", fontSize: 16, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>
                {t.label}
              </span>
              <span style={{ display: "flex", fontSize: 28, fontWeight: 700, color: WHITE }}>
                {t.price}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
