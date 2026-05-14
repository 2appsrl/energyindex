/**
 * ETL TTF — Title Transfer Facility (Dutch hub), front-month gas future.
 * Benchmark europeo del gas naturale; il PSV italiano insegue il TTF con
 * uno spread di 1-3 €/MWh tipico.
 *
 * Fonte: Yahoo Finance API non ufficiale, simbolo TTF=F.
 *   GET https://query1.finance.yahoo.com/v8/finance/chart/TTF=F?range=...&interval=1d
 * Response: { chart: { result: [{ meta:{currency:"EUR"}, timestamp:[...], indicators:{quote:[{close:[...]}]} }] } }
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { fileURLToPath } from "node:url";
import { BaseIngestor, type Observation } from "./lib/base-ingestor";

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: { currency: string };
      timestamp: number[];
      indicators: { quote: Array<{ close: (number | null)[] }> };
    }> | null;
    error?: { code: string; description: string } | null;
  };
}

export class TTFIngestor extends BaseIngestor {
  name = "ttf";
  assetSlug = "ttf";
  granularity = "daily" as const;

  async fetch(start: Date, end: Date): Promise<YahooChartResponse> {
    // Yahoo accetta period1/period2 in epoch seconds, oppure range="5y" etc.
    const period1 = Math.floor(start.getTime() / 1000);
    const period2 = Math.floor(end.getTime() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/TTF=F?period1=${period1}&period2=${period2}&interval=1d`;
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (!res.ok) {
      throw new Error(`Yahoo Finance HTTP ${res.status}: ${await res.text()}`);
    }
    return (await res.json()) as YahooChartResponse;
  }

  parse(raw: YahooChartResponse): Observation[] {
    if (!raw.chart.result || raw.chart.result.length === 0) {
      if (raw.chart.error) {
        throw new Error(
          `Yahoo Finance error: ${raw.chart.error.code} - ${raw.chart.error.description}`,
        );
      }
      return [];
    }
    const result = raw.chart.result[0];
    if (result.meta.currency !== "EUR") {
      // Sanity check: il TTF deve essere in EUR. Se diverso, qualcosa di grave.
      throw new Error(
        `Yahoo TTF=F currency inattesa: '${result.meta.currency}' (atteso 'EUR')`,
      );
    }
    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const out: Observation[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close === null || close === undefined || !Number.isFinite(close)) continue;
      // Timestamp Yahoo e' di solito mezzanotte UTC del giorno di trading.
      // Normalizziamo a mezzogiorno UTC per coerenza con gli altri asset daily.
      const d = new Date(timestamps[i] * 1000);
      const observed_at = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12),
      );
      out.push({ observed_at, value: Number(close) });
    }
    return out;
  }
}

// Entry CLI: ESM-safe.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void (async () => {
    const result = await new TTFIngestor().run();
    process.exit(result.status === "success" ? 0 : 1);
  })();
}
