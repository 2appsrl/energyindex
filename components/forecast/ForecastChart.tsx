"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  AreaSeries,
  LineSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";

export interface ForecastChartPoint {
  date: string;                 // YYYY-MM-DD
  source: "history" | "forecast";
  value: number;
  value_lower: number | null;
  value_upper: number | null;
}

/**
 * Chart unificato storico+forecast con banda di confidenza.
 *
 * Layer:
 *  - Area: storico (verde solido, opacita' alta)
 *  - Line: forecast (verde chiaro, dashed)
 *  - Area trasparente: banda 5-95% (sotto la linea forecast)
 */
export function ForecastChart({
  points,
  unit,
}: {
  points: ForecastChartPoint[];
  unit: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const isDark = document.documentElement.classList.contains("dark");
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 360,
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
        priceFormatter: (v: number) => `${v.toFixed(2)} ${unit}`,
      },
    });

    const toTime = (iso: string): Time => iso as Time;

    const history = points.filter((p) => p.source === "history");
    const forecast = points.filter((p) => p.source === "forecast");

    const histSeries = chart.addSeries(AreaSeries, {
      lineColor: "#14d97a",
      topColor: "rgba(20, 217, 122, 0.35)",
      bottomColor: "rgba(20, 217, 122, 0)",
      priceLineVisible: false,
    });
    histSeries.setData(history.map((p) => ({ time: toTime(p.date), value: p.value })));

    if (forecast.length > 0) {
      const upperBand = chart.addSeries(AreaSeries, {
        lineColor: "rgba(20, 217, 122, 0.2)",
        topColor: "rgba(20, 217, 122, 0.18)",
        bottomColor: "rgba(20, 217, 122, 0.04)",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      upperBand.setData(
        forecast.map((p) => ({ time: toTime(p.date), value: p.value_upper ?? p.value })),
      );

      const fcLine = chart.addSeries(LineSeries, {
        color: "#16a34a",
        lineWidth: 2,
        lineStyle: 2,
        priceLineVisible: false,
      });
      fcLine.setData(forecast.map((p) => ({ time: toTime(p.date), value: p.value })));
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const onResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [points, unit]);

  return <div ref={containerRef} className="w-full" />;
}
