import { romeDateOf } from "@/supabase/functions/_shared/rome-time";

export interface HourlyRow {
  observed_at: string;
  value: number | string | null;
}

/**
 * Media aritmetica delle ore per giorno italiano (Europe/Rome): e' la
 * definizione del PUN giornaliero pubblicato dal GME (PUN Index GME).
 */
export function dailyAveragesRome(
  rows: HourlyRow[],
): Map<string, { value: number; hours: number }> {
  const acc = new Map<string, { sum: number; hours: number }>();
  for (const r of rows) {
    const v = Number(r.value);
    if (r.value === null || !Number.isFinite(v)) continue;
    const day = romeDateOf(r.observed_at);
    const a = acc.get(day) ?? { sum: 0, hours: 0 };
    a.sum += v;
    a.hours += 1;
    acc.set(day, a);
  }
  const out = new Map<string, { value: number; hours: number }>();
  for (const [day, a] of acc) out.set(day, { value: a.sum / a.hours, hours: a.hours });
  return out;
}
