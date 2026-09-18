import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, FONT, FONT_MONO } from "../theme";

/**
 * Big-number hero (PUN 0,124 €/kWh) — count-up animation, unit muted, kicker
 * on top, optional footnote below.
 */
export function BigNumber({
  kicker,
  from,
  to,
  fractionDigits = 2,
  unit,
  footnote,
  duration,
  accentColor = theme.accent,
}: {
  kicker: string;
  from: number;
  to: number;
  fractionDigits?: number;
  unit: string;
  footnote?: string;
  duration: number;
  accentColor?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 200, mass: 0.6 },
    durationInFrames: Math.min(45, duration - 10),
  });
  const value = interpolate(progress, [0, 1], [from, to]);
  const enterAlpha = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const exitAlpha = interpolate(frame, [duration - 14, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const alpha = Math.min(enterAlpha, exitAlpha);

  const fmt = new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT,
        opacity: alpha,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            color: accentColor,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            marginBottom: 40,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            gap: 24,
            fontFamily: FONT_MONO,
          }}
        >
          <div
            style={{
              color: theme.text,
              fontSize: 240,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -8,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmt.format(value)}
          </div>
          <div
            style={{
              color: theme.textMuted,
              fontSize: 60,
              fontWeight: 500,
            }}
          >
            {unit}
          </div>
        </div>
        {footnote && (
          <div
            style={{
              marginTop: 40,
              color: theme.textMuted,
              fontSize: 26,
              fontWeight: 400,
            }}
          >
            {footnote}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}
