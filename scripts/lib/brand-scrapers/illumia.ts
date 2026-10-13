/**
 * Illumia — pagine dettaglio offerta (le pagine elenco sono client-rendered,
 * i dettagli no). Config esplicita per pagina: regex prezzo + quota.
 *
 *   FiXXa:  "Prezzo della componente energia 0,120 €/kWh ... Pari a 1,66 €/mese"
 *   Rossa:  "Luce Prezzo Componente Energia Bloccato 3 anni | ... 0,135 €/kWh 84 €/anno"
 *           "Gas Prezzo Componente Gas 0,75 €/Smc ... 84 €/anno"
 */
import {
  parseItNumber,
  slugify,
  type BrandScraper,
  type ScrapedOffer,
} from "./types";

const URL_FIXXA = "https://www.illumia.it/casa/luce/energia-fixxa-landing/";
const URL_ROSSA =
  "https://www.illumia.it/casa/luce-gas/energia-lunghissima-luce-gas-rossa";

interface PageSpec {
  url: string;
  pageIndex: number;
  offers: Array<{
    offerName: string;
    commodity: "electricity" | "gas";
    priceType: "fisso" | "variabile";
    /** gruppo 1 = prezzo */
    priceRe: RegExp;
    /** gruppo 1 = €/mese oppure €/anno (vedi monthlyIsAnnual) */
    monthlyRe: RegExp | null;
    monthlyIsAnnual?: boolean;
    notes: string | null;
  }>;
}

const PAGES: PageSpec[] = [
  {
    url: URL_FIXXA,
    pageIndex: 0,
    offers: [
      {
        offerName: "Energia FiXXa Luce",
        commodity: "electricity",
        priceType: "fisso",
        priceRe: /Prezzo della componente energia\s*([\d.,]+)\s*€\/kWh/i,
        monthlyRe: /Pari a\s*([\d.,]+)\s*€\/mese/i,
        notes: "Prezzo fisso 20 anni",
      },
    ],
  },
  {
    url: URL_ROSSA,
    pageIndex: 1,
    offers: [
      {
        offerName: "Energia Lunghissima Rossa Luce",
        commodity: "electricity",
        priceType: "fisso",
        priceRe:
          /Luce Prezzo Componente Energia[\s\S]{0,80}?([\d.,]+)\s*€\/kWh\s*([\d.,]+)\s*€\/anno/i,
        monthlyRe:
          /Luce Prezzo Componente Energia[\s\S]{0,80}?[\d.,]+\s*€\/kWh\s*([\d.,]+)\s*€\/anno/i,
        monthlyIsAnnual: true,
        notes: "Prezzo fisso 3 anni (bundle luce+gas)",
      },
      {
        offerName: "Energia Lunghissima Rossa Gas",
        commodity: "gas",
        priceType: "fisso",
        priceRe: /Gas Prezzo Componente Gas\s*([\d.,]+)\s*€\/Smc/i,
        monthlyRe:
          /Gas Prezzo Componente Gas\s*[\d.,]+\s*€\/Smc[\s\S]{0,80}?([\d.,]+)\s*€\/anno/i,
        monthlyIsAnnual: true,
        notes: "Prezzo fisso 3 anni (bundle luce+gas)",
      },
    ],
  },
];

export function parseIllumia(texts: string[]): ScrapedOffer[] {
  const offers: ScrapedOffer[] = [];
  for (const page of PAGES) {
    const text = texts[page.pageIndex] ?? "";
    for (const spec of page.offers) {
      const pm = text.match(spec.priceRe);
      if (!pm) continue;
      let monthly: number | null = null;
      if (spec.monthlyRe) {
        const mm = text.match(spec.monthlyRe);
        if (mm) {
          monthly = parseItNumber(mm[1]);
          if (spec.monthlyIsAnnual) monthly = Math.round((monthly / 12) * 100) / 100;
        }
      }
      const slug = slugify(spec.offerName);
      offers.push({
        externalId: `illumia-${slug}`,
        offerCode: `illumia-${slug}`,
        offerName: spec.offerName,
        commodity: spec.commodity,
        priceType: spec.priceType,
        priceValue: parseItNumber(pm[1]),
        fixedCostMonthly: monthly,
        sourceUrl: page.url,
        notes: spec.notes,
      });
    }
  }
  return offers;
}

export const illumiaScraper: BrandScraper = {
  brand: "illumia",
  supplier: "Illumia",
  urls: [URL_FIXXA, URL_ROSSA],
  parse: parseIllumia,
};
