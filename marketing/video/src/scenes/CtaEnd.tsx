import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, FONT, FONT_MONO } from "../theme";

/**
 * Final CTA card: EIDX logo mark + product name + URL + kicker (pricing line
 * for pro, "gratis" for consumer). Zoom-in on logo, fade-in on URL.
 */
export function CtaEnd({
  productName,
  url,
  kicker,
  duration,
}: {
  productName: string;
  url: string;
  kicker: string;
  duration: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 30,
  });
  const scale = interpolate(logoSpring, [0, 1], [0.6, 1]);
  const alpha = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const urlAlpha = interpolate(frame, [22, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT,
        opacity: Math.min(alpha, exit),
      }}
    >
      <div
        style={{
          textAlign: "center",
          transform: `scale(${scale})`,
        }}
      >
        {/* EI mark, matches app/icon.svg */}
        <div
          style={{
            width: 180,
            height: 180,
            backgroundColor: theme.bgCard,
            borderLeft: `14px solid ${theme.accent}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT_MONO,
            fontSize: 84,
            fontWeight: 500,
            color: theme.text,
            letterSpacing: 2,
            margin: "0 auto 42px",
            borderRadius: 14,
          }}
        >
          EI
        </div>
        <div
          style={{
            color: theme.text,
            fontSize: 84,
            fontWeight: 700,
            letterSpacing: -2,
            marginBottom: 24,
          }}
        >
          {productName}
        </div>
        <div
          style={{
            color: theme.textMuted,
            fontSize: 34,
            fontWeight: 400,
            marginBottom: 40,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            opacity: urlAlpha,
            color: theme.accent,
            fontSize: 48,
            fontWeight: 600,
            letterSpacing: -0.5,
            fontFamily: FONT_MONO,
          }}
        >
          {url}
        </div>
      </div>
    </AbsoluteFill>
  );
}
