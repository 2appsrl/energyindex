"use client";
import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";

export interface TrendSeries {
  slug: string;
  label: string;
  color: string;
  points: Array<{ date: string; value: number }>;
}

export function AggregateTrendChart({
  series,
  unit,
}: {
  series: TrendSeries[];
  unit: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const isDark = document.documentElement.classList.contains("dark");
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: {
        background: { color: "transparent" },
        textColor: isDark ? "#e5e7eb" : "#1f2937",
      },
      grid: {
        vertLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
        horzLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
      },
      timeScale: { timeVisible: false, secondsVisible: false },
      localization: {
        priceFormatter: (v: number) => `${v.toFixed(4)} ${unit}`,
      },
    });

    for (const s of series) {
      const line = chart.addSeries(LineSeries, {
        color: s.color,
        lineWidth: 2,
        title: s.label,
      });
      line.setData(
        s.points.map((p) => ({
          time: Math.floor(new Date(p.date).getTime() / 1000) as Time,
          value: p.value,
        })),
      );
    }
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const onResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [series, unit]);

  return <div ref={containerRef} className="w-full" />;
}
