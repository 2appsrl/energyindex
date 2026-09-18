import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, FONT } from "../theme";

/**
 * Full-screen text reveal a la Apple keynote:
 *  - big line (hero)
 *  - optional smaller subline (kicker)
 *  - subtle fade + rise from below on enter
 *  - fade to black on exit
 */
export function KeynoteTitle({
  hero,
  kicker,
  align = "center",
  color = theme.text,
  bg = theme.bg,
  duration,
}: {
  hero: string;
  kicker?: string;
  align?: "center" | "left";
  color?: string;
  bg?: string;
  /** Length of this scene in frames (used for exit fade). */
  duration: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterY = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });
  const enterAlpha = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const exitAlpha = interpolate(frame, [duration - 18, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const alpha = Math.min(enterAlpha, exitAlpha);
  const translateY = interpolate(enterY, [0, 1], [40, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        justifyContent: "center",
        alignItems: align === "left" ? "flex-start" : "center",
        padding: align === "left" ? "0 140px" : 0,
        fontFamily: FONT,
        opacity: alpha,
      }}
    >
      <div
        style={{
          textAlign: align,
          transform: `translateY(${translateY}px)`,
          maxWidth: 1500,
        }}
      >
        {kicker && (
          <div
            style={{
              color: theme.accent,
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 28,
            }}
          >
            {kicker}
          </div>
        )}
        <div
          style={{
            color,
            fontSize: 108,
            lineHeight: 1.05,
            fontWeight: 700,
            letterSpacing: -3,
          }}
        >
          {hero}
        </div>
      </div>
    </AbsoluteFill>
  );
}
