/**
 * Scraper offerte online dei brand (canale 'scraping_brand_site').
 *
 * Ogni scraper lavora sul TESTO della pagina (tag HTML rimossi, entities
 * decodificate, whitespace collassato): i siti cambiano markup spesso, il
 * testo visibile molto meno. I parser sono funzioni pure testabili su
 * fixture HTML reali (tests/parsers/brand-offers.test.ts).
 *
 * Convenzioni prezzi (come mercato_libero_offers):
 *  - priceValue in €/kWh o €/Smc; per le variabili e' lo SPREAD sull'indice
 *  - fixedCostMonthly = quota commercializzazione €/mese (annuo / 12)
 *  - solo domestico; le offerte PLACET esposte dai brand vengono scartate
 *    (gia' coperte dal canale placet_arera).
 */

export interface ScrapedOffer {
  /** Stabile tra run: `${brand}-${slug offerta}-${commodity}`. */
  externalId: string;
  offerCode: string;
  offerName: string;
  commodity: "electricity" | "gas";
  priceType: "fisso" | "variabile";
  priceValue: number;
  fixedCostMonthly: number | null;
  sourceUrl: string;
  notes: string | null;
}

export interface BrandScraper {
  /** Slug per source_brand (es. 'octopus'). */
  brand: string;
  /** Nome fornitore per la colonna supplier (es. 'Octopus Energy'). */
  supplier: string;
  /** Pagine da scaricare; lo scrape riceve i testi gia' estratti. */
  urls: string[];
  /** Parser puro: testo pagina per ciascun url (stesso ordine). */
  parse(texts: string[]): ScrapedOffer[];
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

/** Fetch con UA da browser e timeout; ritorna l'HTML grezzo. */
export async function fetchHtml(url: string, timeoutMs = 25_000): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} per ${url}`);
  return res.text();
}

/**
 * HTML → testo piatto. NON rimuove il contenuto degli script: su siti
 * Next.js/Alpine i prezzi vivono nei payload embedded e il pattern
 * "0,165 €/kWh" e' comunque inequivocabile.
 */
export function htmlToText(html: string): string {
  let t = html.replace(/<[^>]+>/g, " ");
  t = t
    .replace(/&#x27;|&#39;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#34;|&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return t.replace(/\s+/g, " ");
}

/** "0,165" | "1.234,5" → number (formato it-IT). */
export function parseItNumber(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

/** Nome offerta → slug per externalId/offerCode. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
