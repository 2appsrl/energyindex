import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme, FONT, FONT_MONO } from "../theme";

/**
 * Line chart with progressive stroke reveal + optional forecast fan (dashed
 * band that appears after main line is drawn).
 */
export function LineChartScene({
  kicker,
  title,
  points,
  forecast,
  duration,
  yLabelSuffix = "",
}: {
  kicker: string;
  title: string;
  /** Historical points, values only (equally spaced on x). */
  points: number[];
  /** Optional forecast values continuing from the last historical point. */
  forecast?: number[];
  duration: number;
  yLabelSuffix?: string;
}) {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const exit = interpolate(frame, [duration - 14, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const alpha = Math.min(enter, exit);

  const W = 1640;
  const H = 620;
  const PADX = 40;
  const PADY = 40;

  const all = forecast ? [...points, ...forecast] : points;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(0.0001, max - min);

  const x = (i: number, n: number) => PADX + (i * (W - PADX * 2)) / (n - 1);
  const y = (v: number) => PADY + (1 - (v - min) / span) * (H - PADY * 2);

  const nHist = points.length;
  const nAll = all.length;

  const histPath = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i, nAll).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(" ");
  const fcPath = forecast
    ? [points[points.length - 1], ...forecast]
        .map((v, i) => {
          const idx = nHist - 1 + i;
          return `${i === 0 ? "M" : "L"} ${x(idx, nAll).toFixed(2)} ${y(v).toFixed(2)}`;
        })
        .join(" ")
    : null;

  // Progressive stroke reveal 0..1
  const strokeProgress = interpolate(frame, [14, Math.min(duration - 20, 90)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fcProgress = forecast
    ? interpolate(frame, [90, Math.min(duration - 10, 150)], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // Compute total lengths via svg pathLength trick: use dasharray with a large value.
  const HIST_LEN = 6000;
  const FC_LEN = 2500;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        padding: "100px 140px",
        fontFamily: FONT,
        opacity: alpha,
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          color: theme.accent,
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: 3,
          textTransform: "uppercase",
          marginBottom: 18,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          color: theme.text,
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: -1.5,
          marginBottom: 40,
        }}
      >
        {title}
      </div>

      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ maxWidth: "100%" }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = PADY + t * (H - PADY * 2);
          return (
            <line
              key={t}
              x1={PADX}
              x2={W - PADX}
              y1={yy}
              y2={yy}
              stroke={theme.border}
              strokeWidth={1}
            />
          );
        })}
        <path
          d={histPath}
          fill="none"
          stroke={theme.accent}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={HIST_LEN}
          strokeDasharray={HIST_LEN}
          strokeDashoffset={HIST_LEN * (1 - strokeProgress)}
        />
        {fcPath && (
          <path
            d={fcPath}
            fill="none"
            stroke={theme.accentSoft}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="10 10"
            pathLength={FC_LEN}
            strokeDashoffset={FC_LEN * (1 - fcProgress)}
            opacity={fcProgress}
          />
        )}
      </svg>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 24,
          color: theme.textMuted,
          fontSize: 22,
          fontFamily: FONT_MONO,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>
          min {min.toFixed(1)}
          {yLabelSuffix}
        </span>
        <span>
          max {max.toFixed(1)}
          {yLabelSuffix}
        </span>
      </div>
    </AbsoluteFill>
  );
}
