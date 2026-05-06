"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  AreaSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";

export interface PricePoint {
  observed_at: string;
  value: number;
}

export function PriceChart({
  points,
  unit,
}: {
  points: PricePoint[];
  unit: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = document.documentElement.classList.contains("dark");
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { color: "transparent" },
        textColor: isDark ? "#e5e7eb" : "#1f2937",
      },
      grid: {
        vertLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
        horzLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      localization: {
        priceFormatter: (v: number) => `${v.toFixed(2)} ${unit}`,
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#14d97a",
      topColor: "rgba(20, 217, 122, 0.4)",
      bottomColor: "rgba(20, 217, 122, 0.0)",
    });

    series.setData(
      points.map((p) => ({
        time: Math.floor(new Date(p.observed_at).getTime() / 1000) as Time,
        value: p.value,
      })),
    );

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
  }, [points, unit]);

  return <div ref={containerRef} className="w-full" />;
}
