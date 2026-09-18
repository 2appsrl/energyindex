import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme, FONT } from "../theme";

/**
 * Value-prop scene: 3-4 short claims, staggered fade-in, each aligned left,
 * with a small green tick. Ends with all visible.
 */
export function ClaimsList({
  kicker,
  hero,
  claims,
  duration,
}: {
  kicker?: string;
  hero: string;
  claims: string[];
  duration: number;
}) {
  const frame = useCurrentFrame();

  const headerAlpha = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const exit = interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const alpha = Math.min(headerAlpha, exit);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        padding: "120px 160px",
        flexDirection: "column",
        justifyContent: "center",
        fontFamily: FONT,
        opacity: alpha,
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
          fontSize: 84,
          fontWeight: 700,
          letterSpacing: -2,
          marginBottom: 70,
          maxWidth: 1500,
          lineHeight: 1.05,
        }}
      >
        {hero}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {claims.map((c, i) => {
          const startAt = 12 + i * 12;
          const a = interpolate(frame, [startAt, startAt + 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const y = interpolate(a, [0, 1], [22, 0]);
          return (
            <div
              key={c}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                opacity: a,
                transform: `translateY(${y}px)`,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  background: theme.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.bg,
                  fontSize: 22,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                ✓
              </div>
              <div
                style={{
                  color: theme.text,
                  fontSize: 46,
                  fontWeight: 500,
                  letterSpacing: -0.5,
                }}
              >
                {c}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
