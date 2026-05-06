export type TimeframeId = "5Y" | "1Y" | "6M" | "3M" | "1M" | "1S" | "1G";
export type BucketKind = "month" | "day" | "raw";

export interface Timeframe {
  id: TimeframeId;
  label: string;
  /** Postgres `INTERVAL` literal (e.g. "5 years", "30 days") */
  intervalSql: string;
  /** date_trunc unit, or "raw" to skip aggregation (return hourly observations) */
  bucket: BucketKind;
  /** Heading shown above the chart */
  chartTitle: string;
}

export const TIMEFRAMES: readonly Timeframe[] = [
  { id: "5Y", label: "5Y", intervalSql: "5 years",  bucket: "month", chartTitle: "Andamento ultimi 5 anni" },
  { id: "1Y", label: "1Y", intervalSql: "1 year",   bucket: "day",   chartTitle: "Andamento ultimi 12 mesi" },
  { id: "6M", label: "6M", intervalSql: "6 months", bucket: "day",   chartTitle: "Andamento ultimi 6 mesi" },
  { id: "3M", label: "3M", intervalSql: "3 months", bucket: "day",   chartTitle: "Andamento ultimi 3 mesi" },
  { id: "1M", label: "1M", intervalSql: "30 days",  bucket: "day",   chartTitle: "Andamento ultimi 30 giorni" },
  { id: "1S", label: "1S", intervalSql: "7 days",   bucket: "raw",   chartTitle: "Andamento ultime 168 ore" },
  { id: "1G", label: "1G", intervalSql: "1 day",    bucket: "raw",   chartTitle: "Andamento ultime 24 ore" },
] as const;

const ID_SET = new Set<string>(TIMEFRAMES.map((t) => t.id));

export function resolveTimeframe(input: string | undefined): Timeframe {
  if (input && ID_SET.has(input)) {
    return TIMEFRAMES.find((t) => t.id === input)!;
  }
  return TIMEFRAMES[0]; // 5Y default
}
