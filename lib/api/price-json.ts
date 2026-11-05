/**
 * Serializzazione pura degli endpoint /api/v1/{asset}/today: nessun accesso
 * al DB, cosi' formato e date si testano senza Supabase. Il fetch sta in
 * lib/api/latest-price.ts.
 *
 * PUN e PSV vengono dal GME e usano il fuso Europe/Rome: il PUN ha ore di
 * mercato 1..25, il PSV e' il prezzo di riferimento del prodotto giornaliero
 * MGP-GAS, riferito al giorno gas di consegna.
 */

import { dailyAveragesRome, type HourlyRow } from "@/lib/prices/daily-average";
import { romeDateOf, romeDayBoundsUtc, romeHourOf } from "@/supabase/functions/_shared/rome-time";

export interface DailyAverageJson {
  /** Giorno italiano (YYYY-MM-DD) a cui si riferisce la media. */
  date: string;
  value: number;
  unit: string;
  value_native: number;
  unit_native: string;
  /** Ore che compongono la media (24, oppure 23/25 nei giorni di cambio ora). */
  hours: number;
}

export interface LastHourJson {
  date: string;
  /** Ora di mercato GME (1..25). */
  hour: number;
  observed_at: string;
  value: number;
  unit: string;
  value_native: number;
  unit_native: string;
}

export interface LatestPriceJson {
  /**
   * Giorno di riferimento (YYYY-MM-DD). PUN: giorno di mercato nel fuso
   * Europe/Rome. PSV: giorno gas di consegna. Altri indici: data UTC.
   */
  date: string;
  /** Timestamp ISO 8601 completo dell'osservazione. */
  observed_at: string;
  /** Valore nell'unita' "consumer-friendly" (€/kWh per energia, $/bbl per Brent, etc.). */
  value: number;
  /** Unita' del campo `value`. */
  unit: string;
  /** Valore nell'unita' nativa GME (€/MWh per PUN/PSV/TTF). Null se gia' coincide con `value`. */
  value_native?: number;
  /** Unita' nativa. Null se gia' coincide con `unit`. */
  unit_native?: string;
  /** PUN: "daily" se `value` e' la media del giorno, "hourly" se manca e vale l'ultima ora. */
  granularity?: "hourly" | "daily";
  /** PUN: ultima ora pubblicata dal GME. */
  last_hour?: LastHourJson;
  /** PUN: media aritmetica delle ore del giorno italiano, con il numero di ore. */
  daily_average?: DailyAverageJson | null;
  /** PSV: giorno gas di consegna (06:00 → 06:00 del giorno dopo). */
  gas_day?: string;
  /** PSV: giorno della sessione MGP-GAS in cui il prodotto e' stato negoziato. */
  session_date?: string;
  /** PSV: codice del prodotto giornaliero MGP-GAS. */
  product?: string;
  /** Sigla dell'asset (PUN, PSV, ...). */
  asset: string;
  /** Nome esteso human-readable. */
  asset_name: string;
  /** Fonte upstream (GME, ICE, EIA, ...). */
  source: string;
  /** URL della fonte upstream. */
  source_url: string;
  /** Condizioni d'uso della fonte, quando il riuso dipende da essa (GME). */
  source_terms_url?: string;
  /** Stringa di attribuzione obbligatoria per chi consuma l'API. */
  attribution: string;
  /** Pagina di dettaglio Energy Index — backlink reciproco. */
  page: string;
}

interface AssetDef {
  slug: string;
  asset: string;
  name: string;
  source: string;
  sourceUrl: string;
  /** Conversione: se native = €/MWh e consumer = €/kWh → divider = 1000. */
  consumerDivider: number;
  consumerUnit: string;
  page: string;
}

export const ASSETS: Record<string, AssetDef> = {
  pun: {
    slug: "pun",
    asset: "PUN",
    name: "Prezzo Unico Nazionale energia elettrica Italia",
    source: "GME",
    sourceUrl: "https://www.mercatoelettrico.org",
    consumerDivider: 1000, // €/MWh → €/kWh
    consumerUnit: "€/kWh",
    page: "https://energyindex.it/it/indice/pun",
  },
  psv: {
    slug: "psv",
    asset: "PSV",
    name: "PSV — prezzo di riferimento MGP-GAS (GME), prodotto giornaliero",
    source: "GME",
    sourceUrl: "https://www.mercatoelettrico.org/it-it/Home/Esiti/Gas/MGP/Esiti",
    consumerDivider: 1000,
    consumerUnit: "€/kWh",
    page: "https://energyindex.it/it/indice/psv",
  },
  ttf: {
    slug: "ttf",
    asset: "TTF",
    name: "Title Transfer Facility gas Europa",
    source: "ICE Endex",
    sourceUrl: "https://www.theice.com",
    consumerDivider: 1000,
    consumerUnit: "€/kWh",
    page: "https://energyindex.it/it/indice/ttf",
  },
  brent: {
    slug: "brent",
    asset: "Brent",
    name: "Brent crude oil (North Sea)",
    source: "EIA",
    sourceUrl: "https://www.eia.gov",
    consumerDivider: 1, // gia' $/bbl, niente conversione
    consumerUnit: "$/bbl",
    page: "https://energyindex.it/it/indice/brent",
  },
  co2: {
    slug: "co2",
    asset: "CO2",
    name: "Quota emissione CO2 EU ETS (EUA settlement)",
    source: "EEX",
    sourceUrl: "https://www.eex.com",
    consumerDivider: 1, // gia' €/tCO2
    consumerUnit: "€/tCO2",
    page: "https://energyindex.it/it/indice/co2",
  },
};

export const ATTRIBUTION = "Energy Index — https://energyindex.it (gratis, attribuzione richiesta)";

/** Citazione richiesta dalle condizioni d'uso GME, seguita dalla nostra. */
export const GME_ATTRIBUTION =
  "Fonte: Gestore dei Mercati Energetici S.p.A. — via Energy Index (https://energyindex.it)";

export const GME_TERMS_URL = "https://www.mercatoelettrico.org/en-us/Home/TermsOfUse";

export interface ObservationRow {
  observed_at: string;
  value: number | string;
  extra?: Record<string, unknown> | null;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function round(n: number, decimals: number): number {
  return Number(n.toFixed(decimals));
}

/**
 * Media del giorno italiano `today`; se non ci sono ore di oggi (ETL in
 * ritardo) ripiega sull'ultimo giorno precedente disponibile.
 */
export function dailyAverageFor(
  rows: HourlyRow[],
  today: string,
): { date: string; value: number; hours: number } | null {
  const days = [...dailyAveragesRome(rows)].filter(([day]) => day <= today).sort(([a], [b]) => (a < b ? 1 : -1));
  if (days.length === 0) return null;
  const [date, avg] = days[0];
  return { date, value: avg.value, hours: avg.hours };
}

/** Oggetto JSON pubblico dell'ultima osservazione. Null se l'asset non esiste. */
export function buildLatestPriceJson(
  assetSlug: string,
  row: ObservationRow,
  nativeUnit: string,
  dailyAverage?: { date: string; value: number; hours: number } | null,
): LatestPriceJson | null {
  const def = ASSETS[assetSlug];
  if (!def) return null;

  const nativeValue = Number(row.value);
  const consumerValue = nativeValue / def.consumerDivider;
  const observedAt = String(row.observed_at);
  const isGme = def.source === "GME";

  const json: LatestPriceJson = {
    date: isGme ? romeDateOf(observedAt) : observedAt.slice(0, 10),
    observed_at: observedAt,
    // €/kWh con 5 decimali (precisione ~0.001 cent), tipico per le bollette;
    // assets non-energy mantengono 2 decimali
    value: round(consumerValue, def.consumerDivider === 1000 ? 5 : 2),
    unit: def.consumerUnit,
    asset: def.asset,
    asset_name: def.name,
    source: def.source,
    source_url: def.sourceUrl,
    attribution: isGme ? GME_ATTRIBUTION : ATTRIBUTION,
    page: def.page,
  };

  // Aggiungi unita' nativa solo se differente dalla consumer
  if (def.consumerDivider !== 1) {
    json.value_native = round(nativeValue, 2);
    json.unit_native = nativeUnit;
  }

  if (isGme) json.source_terms_url = GME_TERMS_URL;

  if (assetSlug === "pun") {
    json.granularity = "hourly";
    json.last_hour = {
      date: json.date,
      hour: romeHourOf(observedAt),
      observed_at: observedAt,
      value: json.value,
      unit: def.consumerUnit,
      value_native: round(nativeValue, 2),
      unit_native: nativeUnit,
    };
    json.daily_average = null;
    // `value` e' il PUN del giorno: chi legge l'API si aspetta questo, non
    // l'ultima ora pubblicata. Senza media resta l'ora, e granularity lo dice.
    if (dailyAverage) {
      const value = round(dailyAverage.value / def.consumerDivider, 5);
      const native = round(dailyAverage.value, 2);
      json.granularity = "daily";
      json.date = dailyAverage.date;
      json.observed_at = romeDayBoundsUtc(dailyAverage.date).start;
      json.value = value;
      json.value_native = native;
      json.daily_average = {
        date: dailyAverage.date,
        value,
        unit: def.consumerUnit,
        value_native: native,
        unit_native: nativeUnit,
        hours: dailyAverage.hours,
      };
    }
  }

  if (assetSlug === "psv") {
    // observed_at = mezzanotte italiana del giorno gas di consegna (ETL etl-gme-psv).
    const gasDay = json.date;
    const stored = row.extra?.session_date;
    json.granularity = "daily";
    json.gas_day = gasDay;
    json.session_date = typeof stored === "string" ? stored : addDaysIso(gasDay, -1);
    json.product = `MGP-${gasDay}`;
  }

  return json;
}
