/**
 * ETL Brent — EIA Open Data API v2 series PET.RBRTE.D.
 *
 * Esecuzione:
 *   - Daily da GitHub Actions (.github/workflows/etl-brent-daily.yml)
 *   - Manuale: npx tsx scripts/etl-brent.ts
 *
 * Env vars: EIA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { BaseIngestor, type Observation } from "./lib/base-ingestor";

interface EiaRow {
  period: string;
  value: string | null;
}

export class BrentIngestor extends BaseIngestor {
  name = "brent";
  assetSlug = "brent";

  async fetch(start: Date, end: Date): Promise<EiaRow[]> {
    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey) throw new Error("EIA_API_KEY mancante");
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const url = `https://api.eia.gov/v2/seriesid/PET.RBRTE.D?api_key=${apiKey}&start=${startStr}&end=${endStr}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`EIA API ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { response: { data: EiaRow[] } };
    return json.response.data;
  }

  parse(raw: EiaRow[]): Observation[] {
    const out: Observation[] = [];
    for (const row of raw) {
      if (row.value === null || row.value === undefined) continue;
      const num = Number(row.value);
      if (!Number.isFinite(num)) continue;
      out.push({
        observed_at: new Date(`${row.period}T12:00:00Z`),
        value: num,
      });
    }
    return out;
  }
}

if (require.main === module) {
  void (async () => {
    const result = await new BrentIngestor().run();
    process.exit(result.status === "success" ? 0 : 1);
  })();
}
