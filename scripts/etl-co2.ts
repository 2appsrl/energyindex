/**
 * ETL CO2 EUA — strategia a cascata:
 *   1) Ember Climate JSON endpoint
 *   2) Investing.com scraping (fallback)
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import * as cheerio from "cheerio";
import { BaseIngestor, type Observation } from "./lib/base-ingestor";

interface EmberRow { date: string; price_eur: number; instrument?: string }

export function parseEmber(rows: EmberRow[]): Observation[] {
  return rows
    .filter((r) => Number.isFinite(r.price_eur))
    .map((r) => ({
      observed_at: new Date(`${r.date}T12:00:00Z`),
      value: Number(r.price_eur),
    }));
}

export function parseInvesting(html: string): Observation[] {
  const $ = cheerio.load(html);
  const out: Observation[] = [];
  $("table#curr_table tbody tr, table tbody tr").each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length < 2) return;
    const dateStr = $(tds[0]).text().trim();
    const priceStr = $(tds[1]).text().replace(/[, ]/g, ".").trim();
    const date = new Date(dateStr);
    const price = Number(priceStr);
    if (!Number.isFinite(date.getTime()) || !Number.isFinite(price)) return;
    out.push({
      observed_at: new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12)),
      value: price,
    });
  });
  return out;
}

export class Co2Ingestor extends BaseIngestor {
  name = "co2";
  assetSlug = "co2";

  async fetch(): Promise<unknown> {
    // Strategy 1: Ember Climate
    try {
      const res = await fetch("https://ember-climate.org/api/carbon-price/eua-daily");
      if (res.ok) {
        return await res.json();
      }
    } catch { /* fallthrough */ }
    // Strategy 2: Investing scraping
    const res = await fetch(
      "https://www.investing.com/commodities/carbon-emissions-historical-data",
      { headers: { "user-agent": "Mozilla/5.0 EnergyIndex Bot" } },
    );
    if (!res.ok) throw new Error(`Investing fallback HTTP ${res.status}`);
    return await res.text();
  }

  parse(raw: unknown): Observation[] {
    if (typeof raw === "string") return parseInvesting(raw);
    if (typeof raw === "object" && raw !== null && "data" in raw) {
      return parseEmber((raw as { data: EmberRow[] }).data);
    }
    return [];
  }
}

if (require.main === module) {
  void (async () => {
    const result = await new Co2Ingestor().run();
    process.exit(result.status === "success" ? 0 : 1);
  })();
}
