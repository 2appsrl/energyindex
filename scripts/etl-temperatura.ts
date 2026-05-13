/**
 * ETL Temperatura Italia — Open-Meteo API (ERA5 reanalysis + forecast).
 *
 * Scarica T media giornaliera da 9 coordinate (citta' principali italiane),
 * calcola la media nazionale ponderata per popolazione, e la salva come asset
 * "temperatura-it".
 *
 * Open-Meteo NON richiede API key; citiamo la fonte (CC-BY 4.0).
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { fileURLToPath } from "node:url";
import { BaseIngestor, type Observation } from "./lib/base-ingestor";

export interface City {
  name: string;
  lat: number;
  lon: number;
  weight: number;
}

export const CITIES: City[] = [
  { name: "milano",  lat: 45.4642, lon:  9.1900, weight: 0.20 },
  { name: "roma",    lat: 41.9028, lon: 12.4964, weight: 0.18 },
  { name: "napoli",  lat: 40.8518, lon: 14.2681, weight: 0.12 },
  { name: "torino",  lat: 45.0703, lon:  7.6869, weight: 0.10 },
  { name: "bologna", lat: 44.4949, lon: 11.3426, weight: 0.08 },
  { name: "firenze", lat: 43.7696, lon: 11.2558, weight: 0.07 },
  { name: "bari",    lat: 41.1171, lon: 16.8719, weight: 0.08 },
  { name: "palermo", lat: 38.1157, lon: 13.3615, weight: 0.10 },
  { name: "verona",  lat: 45.4384, lon: 10.9916, weight: 0.07 },
];

export function weightedAverage(items: { weight: number; value: number }[]): number | null {
  if (items.length === 0) return null;
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const sum = items.reduce((s, i) => s + i.value * i.weight, 0);
  return sum / totalWeight;
}

interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_mean: (number | null)[];
  };
}

interface CityRaw {
  city: string;
  weight: number;
  rows: { date: string; tavg: number | null }[];
}

export class TemperaturaIngestor extends BaseIngestor {
  name = "temperatura";
  assetSlug = "temperatura-it";

  async fetch(start: Date, end: Date): Promise<CityRaw[]> {
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setUTCDate(fiveDaysAgo.getUTCDate() - 5);
    const useForecast = end >= fiveDaysAgo;

    const out: CityRaw[] = [];
    for (const city of CITIES) {
      const url = useForecast
        ? `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_mean&timezone=Europe%2FRome&past_days=7`
        : `https://archive-api.open-meteo.com/v1/archive?latitude=${city.lat}&longitude=${city.lon}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_mean&timezone=Europe%2FRome`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo ${city.name} HTTP ${res.status}`);
      const json = (await res.json()) as OpenMeteoResponse;
      const rows: { date: string; tavg: number | null }[] = [];
      for (let i = 0; i < json.daily.time.length; i++) {
        rows.push({
          date: json.daily.time[i],
          tavg: json.daily.temperature_2m_mean[i],
        });
      }
      out.push({ city: city.name, weight: city.weight, rows });
      await new Promise((r) => setTimeout(r, 150));
    }
    return out;
  }

  parse(raw: CityRaw[]): Observation[] {
    const byDate = new Map<string, { weight: number; value: number }[]>();
    for (const c of raw) {
      for (const row of c.rows) {
        if (row.tavg === null || !Number.isFinite(row.tavg)) continue;
        const list = byDate.get(row.date) ?? [];
        list.push({ weight: c.weight, value: row.tavg });
        byDate.set(row.date, list);
      }
    }
    const out: Observation[] = [];
    for (const [date, items] of byDate) {
      const avg = weightedAverage(items);
      if (avg === null) continue;
      out.push({
        observed_at: new Date(`${date}T12:00:00Z`),
        value: Math.round(avg * 100) / 100,
      });
    }
    return out.sort((a, b) => a.observed_at.getTime() - b.observed_at.getTime());
  }
}

// Entry CLI: ESM-safe (no `require` in moduli ESM moderni).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void (async () => {
    const result = await new TemperaturaIngestor().run();
    process.exit(result.status === "success" ? 0 : 1);
  })();
}
