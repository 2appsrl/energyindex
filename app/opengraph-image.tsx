import { ImageResponse } from "next/og";

export const alt = "Energy Index — Prezzi luce e gas in tempo reale";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Palette ufficiale brand Energy Index (cfr. public/brand/README.md):
//   Deep Forest  #0A3D2E  - sfondo / badge
//   Signal Green #16A34A  - rail laterale, accenti, freccia
//   White        #FFFFFF  - testo principale
const DEEP_FOREST = "#0a3d2e";
const SIGNAL_GREEN = "#16a34a";
const WHITE = "#ffffff";

// Satori (motore di next/og) richiede display:flex esplicito su ogni <div>
// con piu' di un figlio. Quindi flex everywhere.
export default async function Image() {
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
        {/* Rail verticale Signal Green (replica del badge logo). */}
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
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "0 80px",
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontFamily: "'SF Mono', Menlo, Consolas, monospace",
              fontWeight: 500,
              letterSpacing: 6,
              color: WHITE,
              display: "flex",
            }}
          >
            EIDX · ENERGY INDEX
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              marginTop: 32,
              lineHeight: 1.05,
              color: WHITE,
              letterSpacing: -1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Prezzi luce e gas</span>
            <span>in tempo reale</span>
          </div>
          <div
            style={{
              fontSize: 30,
              color: "rgba(255,255,255,0.72)",
              marginTop: 36,
              fontWeight: 400,
              display: "flex",
            }}
          >
            PUN · PSV · offerte ARERA mercato libero
          </div>
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
            {/* Freccia stile logo. */}
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
