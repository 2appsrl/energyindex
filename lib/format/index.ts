const eurFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fourDecimalFormatter = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export function formatEurMwh(value: number): string {
  return `${eurFormatter.format(value)}/MWh`;
}

export function formatPercentDelta(curr: number, prev: number): string {
  if (prev === 0) return "—";
  const pct = ((curr - prev) / prev) * 100;
  const sign = pct >= 0 ? "▲" : "▼";
  return `${sign} ${Math.abs(pct).toFixed(1)}%`;
}

export function formatRelativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "ora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ore fa`;
  return `${Math.floor(diff / 86400)} g fa`;
}

// Conversioni wholesale -> retail (unita' standard ARERA per la bolletta).
//
//   PUN luce  in €/MWh  ->  €/kWh   (commodity / 1000)
//   PSV gas   in €/MWh  ->  €/Smc   (commodity * 10,5275 / 1000)
//
// 10,5275 kWh/Smc e' il PCS standard ARERA per il gas naturale.
const MWH_TO_KWH = 1 / 1000;
const SMC_KWH = 10.5275;

export type Commodity = "luce" | "gas";

export function formatRetailEquivalent(
  eurPerMwh: number,
  commodity: Commodity,
): string {
  if (commodity === "luce") {
    return `${fourDecimalFormatter.format(eurPerMwh * MWH_TO_KWH)} €/kWh`;
  }
  if (commodity === "gas") {
    return `${fourDecimalFormatter.format(eurPerMwh * MWH_TO_KWH * SMC_KWH)} €/Smc`;
  }
  return "";
}
