/**
 * Pulsee (Axpo) — pulsee.it/offerte-casa-luce-gas/{luce,gas}
 *
 * Card offerta nel testo:
 *   "Luce Relax 36 mesi Monoraria Prezzo fisso Prezzo luce 0,15 €/kWh
 *    Quota vendita luce 144 €/anno"
 *   "Gas Relax Monoraria Prezzo fisso Prezzo gas 0,801 €/smc Quota vendita gas 144 €/anno"
 * Scartiamo: PLACET (canale placet_arera) e "variabile + tetto" (il numero
 * esposto e' il cap, non lo spread).
 */
import {
  parseItNumber,
  slugify,
  type BrandScraper,
  type ScrapedOffer,
} from "./types";

const URL_LUCE = "https://pulsee.it/offerte-casa-luce-gas/luce";
const URL_GAS = "https://pulsee.it/offerte-casa-luce-gas/gas";

const CARD_RE =
  /(Luce|Gas)\s+([A-ZÀ-Ú][\w.à-ú]*(?:\s+(?:[A-ZÀ-Ú\d][\w.à-ú]*|mesi)){0,3})\s+(Monoraria|Bioraria|Multioraria)?\s*Prezzo\s+(fisso|variabile)(\s*\+\s*tetto)?\s*Prezzo\s+(?:luce|gas)\s*([\s\S]{0,140}?)([\d.,]+)\s*€\/(kwh|smc)\s*Quota vendita (?:luce|gas)\s*([\d.,]+)\s*€\/anno/gi;

export function parsePulsee(texts: string[]): ScrapedOffer[] {
  const offers: ScrapedOffer[] = [];
  const pages: Array<[string, string]> = [
    [texts[0] ?? "", URL_LUCE],
    [texts[1] ?? "", URL_GAS],
  ];

  for (const [text, url] of pages) {
    for (const m of text.matchAll(CARD_RE)) {
      const [, commodityWord, rawName, , typeWord, capFlag, between, price, unit, annual] = m;
      const name = `${commodityWord} ${rawName}`.replace(/\s+/g, " ").trim();
      if (/placet/i.test(name)) continue;
      // "variabile + tetto": il prezzo nel testo e' il tetto massimo, non lo
      // spread — non confrontabile col benchmark, si salta.
      if (capFlag || /non pagherai/i.test(between)) continue;

      const commodity = unit.toLowerCase() === "kwh" ? "electricity" : "gas";
      const slug = slugify(name);
      if (offers.some((o) => o.externalId === `pulsee-${slug}`)) continue;

      offers.push({
        externalId: `pulsee-${slug}`,
        offerCode: `pulsee-${slug}`,
        offerName: name,
        commodity,
        priceType: typeWord.toLowerCase() === "fisso" ? "fisso" : "variabile",
        priceValue: parseItNumber(price),
        fixedCostMonthly: Math.round((parseItNumber(annual) / 12) * 100) / 100,
        sourceUrl: url,
        notes: null,
      });
    }
  }
  return offers;
}

export const pulseeScraper: BrandScraper = {
  brand: "pulsee",
  supplier: "Pulsee",
  urls: [URL_LUCE, URL_GAS],
  parse: parsePulsee,
};
