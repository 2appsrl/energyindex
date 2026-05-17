/**
 * EnergiaPro REST API client.
 *
 * Endpoint: GET https://energiapro.biz/api/v1/offers
 * Auth: header X-API-Key (env ENERGIAPRO_API_KEY)
 * Rate limit: 60 req/min. Retry exponential su 429.
 *
 * Note: l'API restituisce solo offerte attive (valid_to nullo o futuro).
 */
const BASE_URL = "https://energiapro.biz/api/v1";
const SUPPLIER_LOGO_BASE = "https://energiapro.biz";

export interface EnergiaProOffer {
  id: string;
  offer_code: string;
  offer_name: string | null;
  supplier: string;
  supplier_slug: string;
  supplier_logo_url: string | null;     // relative path, normalizzato dal client
  commodity: "electricity" | "gas";
  price_type: "fisso" | "variabile";
  price_value: number;
  price_unit: "€/kWh" | "€/Smc";
  customer_segment: "domestico" | "business";
  valid_from: string | null;             // YYYY-MM-DD
  valid_to: string | null;
  source_url: string | null;
  last_verified_at: string | null;       // formato "YYYY-MM-DD HH:MM:SS"
  notes: string | null;
}

export interface EnergiaProResponse {
  meta: {
    total: number;
    limit: number;
    offset: number;
    generated_at: string;
    data_freshness_hours: number;
  };
  offers: EnergiaProOffer[];
}

export interface FetchOffersParams {
  commodity?: "electricity" | "gas";
  price_type?: "fisso" | "variabile";
  customer_segment?: "domestico" | "business";
  supplier?: string;
  limit?: number;
  offset?: number;
}

function getApiKey(): string {
  const key = process.env.ENERGIAPRO_API_KEY;
  if (!key) throw new Error("env ENERGIAPRO_API_KEY mancante");
  return key;
}

/** Normalize supplier_logo_url: relative path -> absolute on energiapro.biz */
export function normalizeLogo(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SUPPLIER_LOGO_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function fetchOffersPage(p: FetchOffersParams = {}): Promise<EnergiaProResponse> {
  const q = new URLSearchParams();
  if (p.commodity) q.set("commodity", p.commodity);
  if (p.price_type) q.set("price_type", p.price_type);
  if (p.customer_segment) q.set("customer_segment", p.customer_segment);
  if (p.supplier) q.set("supplier", p.supplier);
  if (p.limit !== undefined) q.set("limit", String(p.limit));
  if (p.offset !== undefined) q.set("offset", String(p.offset));
  const qs = q.toString();
  const url = `${BASE_URL}/offers${qs ? `?${qs}` : ""}`;

  const maxAttempts = 5;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, {
      headers: {
        "X-API-Key": getApiKey(),
        "Accept": "application/json",
      },
    });
    if (res.ok) {
      return (await res.json()) as EnergiaProResponse;
    }
    if (res.status === 401) {
      throw new Error(`energiapro: 401 Unauthorized (chiave API errata o scaduta)`);
    }
    if (res.status === 400) {
      const body = await res.text();
      throw new Error(`energiapro: 400 Bad Request: ${body}`);
    }
    if (res.status === 429) {
      // Backoff esponenziale: 1s, 2s, 4s, 8s, 16s
      const wait = Math.pow(2, attempt) * 1000;
      console.warn(`[energiapro] 429 rate limit, retry in ${wait}ms (attempt ${attempt + 1}/${maxAttempts})`);
      await sleep(wait);
      lastErr = new Error(`429 rate limit dopo ${attempt + 1} tentativi`);
      continue;
    }
    if (res.status >= 500) {
      const wait = (attempt + 1) * 2000;
      console.warn(`[energiapro] ${res.status} server error, retry in ${wait}ms`);
      await sleep(wait);
      lastErr = new Error(`${res.status} server error`);
      continue;
    }
    throw new Error(`energiapro: HTTP ${res.status}`);
  }
  throw lastErr ?? new Error("energiapro: max retries exceeded");
}

/**
 * Pagina automaticamente fino a esaurire `meta.total`. Filtri opzionali
 * applicati a livello API. Restituisce tutti gli offer come array unico.
 */
export async function fetchAllOffers(filters: Omit<FetchOffersParams, "limit" | "offset"> = {}): Promise<EnergiaProOffer[]> {
  const PAGE_SIZE = 200;
  const collected: EnergiaProOffer[] = [];
  let offset = 0;
  while (true) {
    const page = await fetchOffersPage({ ...filters, limit: PAGE_SIZE, offset });
    collected.push(...page.offers);
    if (page.offers.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset >= page.meta.total) break;
    // Piccola pausa tra le pagine per non saturare il rate limit
    await sleep(200);
  }
  return collected;
}
