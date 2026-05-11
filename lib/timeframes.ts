export type TimeframeId = "5Y" | "1Y" | "6M" | "3M" | "1M" | "1S" | "1G";
export type BucketKind = "month" | "week" | "day" | "raw";
export type SourceGranularity = "hourly" | "daily";

interface TimeframeTemplate {
  id: TimeframeId;
  label: string;
  intervalSql: string;
  chartTitle: string;
  buckets: Record<SourceGranularity, BucketKind>;
}

export interface Timeframe {
  id: TimeframeId;
  label: string;
  intervalSql: string;
  chartTitle: string;
  bucket: BucketKind;
}

const TEMPLATES: readonly TimeframeTemplate[] = [
  { id: "5Y", label: "5Y", intervalSql: "5 years",  chartTitle: "Andamento ultimi 5 anni",   buckets: { hourly: "month", daily: "month" } },
  { id: "1Y", label: "1Y", intervalSql: "1 year",   chartTitle: "Andamento ultimi 12 mesi",  buckets: { hourly: "day",   daily: "week"  } },
  { id: "6M", label: "6M", intervalSql: "6 months", chartTitle: "Andamento ultimi 6 mesi",   buckets: { hourly: "day",   daily: "raw"   } },
  { id: "3M", label: "3M", intervalSql: "3 months", chartTitle: "Andamento ultimi 3 mesi",   buckets: { hourly: "day",   daily: "raw"   } },
  { id: "1M", label: "1M", intervalSql: "30 days",  chartTitle: "Andamento ultimi 30 giorni",buckets: { hourly: "day",   daily: "raw"   } },
  { id: "1S", label: "1S", intervalSql: "7 days",   chartTitle: "Andamento ultime 168 ore",  buckets: { hourly: "raw",   daily: "raw"   } },
  { id: "1G", label: "1G", intervalSql: "1 day",    chartTitle: "Andamento ultime 24 ore",   buckets: { hourly: "raw",   daily: "raw"   } },
] as const;

/** Esposto pubblicamente per il rendering del selector (id + label sono sufficienti). */
export const TIMEFRAMES: readonly Pick<Timeframe, "id" | "label">[] = TEMPLATES.map(
  (t) => ({ id: t.id, label: t.label }),
);

const TEMPLATE_BY_ID = new Map<string, TimeframeTemplate>(
  TEMPLATES.map((t) => [t.id, t]),
);

export function resolveTimeframe(
  input: string | undefined,
  source: SourceGranularity = "hourly",
): Timeframe {
  const template = (input ? TEMPLATE_BY_ID.get(input) : undefined) ?? TEMPLATES[0];
  return {
    id: template.id,
    label: template.label,
    intervalSql: template.intervalSql,
    chartTitle: template.chartTitle,
    bucket: template.buckets[source],
  };
}
