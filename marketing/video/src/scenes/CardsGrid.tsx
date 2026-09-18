import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, FONT, FONT_MONO } from "../theme";

export interface StatCard {
  label: string;
  value: string;
  unit: string;
  delta?: string;
  deltaColor?: string;
  icon?: string;
}

/**
 * Cards grid (2-3-4 col) — stagger enter from bottom, minimal look.
 */
export function CardsGrid({
  kicker,
  hero,
  cards,
  duration,
  columns,
}: {
  kicker?: string;
  hero: string;
  cards: StatCard[];
  duration: number;
  columns: 2 | 3 | 4;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerAlpha = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const exitAlpha = interpolate(frame, [duration - 14, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const alpha = Math.min(headerAlpha, exitAlpha);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        padding: "120px 140px",
        fontFamily: FONT,
        opacity: alpha,
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {kicker && (
        <div
          style={{
            color: theme.accent,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 22,
          }}
        >
          {kicker}
        </div>
      )}
      <div
        style={{
          color: theme.text,
          fontSize: 76,
          fontWeight: 700,
          letterSpacing: -2,
          marginBottom: 70,
        }}
      >
        {hero}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 28,
        }}
      >
        {cards.map((c, i) => {
          const stagger = spring({
            frame: frame - 8 - i * 6,
            fps,
            config: { damping: 200 },
            durationInFrames: 25,
          });
          const y = interpolate(stagger, [0, 1], [40, 0]);
          const a = interpolate(stagger, [0, 1], [0, 1]);
          return (
            <div
              key={c.label}
              style={{
                background: "linear-gradient(180deg, rgba(22,163,74,0.09) 0%, rgba(22,163,74,0.02) 100%)",
                border: `1px solid ${theme.border}`,
                borderRadius: 20,
                padding: 34,
                transform: `translateY(${y}px)`,
                opacity: a,
                minHeight: 220,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 26,
                }}
              >
                {c.icon && <span style={{ fontSize: 40 }}>{c.icon}</span>}
                {c.delta && (
                  <span
                    style={{
                      color: c.deltaColor ?? theme.up,
                      background: `${c.deltaColor ?? theme.up}22`,
                      padding: "6px 14px",
                      borderRadius: 999,
                      fontSize: 20,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      fontFamily: FONT_MONO,
                    }}
                  >
                    {c.delta}
                  </span>
                )}
              </div>
              <div style={{ color: theme.textMuted, fontSize: 22, marginBottom: 12 }}>{c.label}</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  fontFamily: FONT_MONO,
                }}
              >
                <div
                  style={{
                    color: theme.text,
                    fontSize: 58,
                    fontWeight: 700,
                    letterSpacing: -1,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {c.value}
                </div>
                <div style={{ color: theme.textMuted, fontSize: 22 }}>{c.unit}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
