/**
 * Octopus Energy — octopusenergy.it/le-nostre-tariffe
 *
 * La pagina (Next.js) espone tutte le tariffe nel testo con pattern stabili:
 *   "Octopus Fissa 24M ... Materia prima: 0,165 €/kWh Commercializzazione 6 €/mese
 *    ... Gas Gas Materia prima: 0,69 €/Smc Commercializzazione 7 €/mese"
 *   "Octopus Flex ... Materia prima: PUN ... + 0,0088 €/kWh Commercializzazione ..."
 * I blocchi PLACET (PLACET Fissa/Variabile Domestico) vengono scartati.
 */
import {
  parseItNumber,
  slugify,
  type BrandScraper,
  type ScrapedOffer,
} from "./types";

const URL = "https://octopusenergy.it/le-nostre-tariffe";

/** Anchor = nome offerta che precede il blocco prezzi. */
const ANCHOR_RE = /Octopus\s+(?:Fissa\s+\d+M|Flex)|PLACET\s+\w+(?:\s+Domestico)?/g;

interface PriceHit {
  index: number;
  commodity: "electricity" | "gas";
  priceType: "fisso" | "variabile";
  priceValue: number;
  monthly: number;
}

function findHits(text: string): PriceHit[] {
  const hits: PriceHit[] = [];
  const push = (
    re: RegExp,
    commodity: PriceHit["commodity"],
    priceType: PriceHit["priceType"],
  ) => {
    for (const m of text.matchAll(re)) {
      hits.push({
        index: m.index ?? 0,
        commodity,
        priceType,
        priceValue: parseItNumber(m[1]),
        monthly: parseItNumber(m[2]),
      });
    }
  };
  // Fisso: "Materia prima: 0,165 €/kWh Commercializzazione 6 €/mese"
  push(
    /Materia prima:\s*([\d.,]+)\s*€\/kWh\s*Commercializzazione\s*([\d.,]+)\s*€\/mese/g,
    "electricity",
    "fisso",
  );
  push(
    /Materia prima:\s*([\d.,]+)\s*€\/Smc\s*Commercializzazione\s*([\d.,]+)\s*€\/mese/g,
    "gas",
    "fisso",
  );
  // Variabile: "Materia prima: PUN ... + 0,0088 €/kWh Commercializzazione 6 €/mese"
  push(
    /Materia prima:\s*PUN[\s\S]{0,400}?\+\s*([\d.,]+)\s*€\/kWh\s*Commercializzazione\s*([\d.,]+)\s*€\/mese/g,
    "electricity",
    "variabile",
  );
  push(
    /Materia prima:\s*PSV\w*[\s\S]{0,400}?\+\s*([\d.,]+)\s*€\/Smc\s*Commercializzazione\s*([\d.,]+)\s*€\/mese/g,
    "gas",
    "variabile",
  );
  return hits;
}

export function parseOctopus(text: string): ScrapedOffer[] {
  const anchors = [...text.matchAll(ANCHOR_RE)].map((m) => ({
    index: m.index ?? 0,
    name: m[0].replace(/\s+/g, " ").trim(),
  }));

  const offers: ScrapedOffer[] = [];
  for (const hit of findHits(text)) {
    // Nome offerta = anchor piu' vicino che PRECEDE il blocco prezzi.
    const anchor = [...anchors].reverse().find((a) => a.index < hit.index);
    if (!anchor || /PLACET/i.test(anchor.name)) continue;

    const suffix = hit.commodity === "electricity" ? "Luce" : "Gas";
    const name = `${anchor.name} ${suffix}`;
    const slug = slugify(name);
    if (offers.some((o) => o.externalId === `octopus-${slug}`)) continue;

    offers.push({
      externalId: `octopus-${slug}`,
      offerCode: `octopus-${slug}`,
      offerName: name,
      commodity: hit.commodity,
      priceType: hit.priceType,
      priceValue: hit.priceValue,
      fixedCostMonthly: hit.monthly,
      sourceUrl: URL,
      notes:
        hit.priceType === "variabile"
          ? `Spread su ${hit.commodity === "electricity" ? "PUN" : "PSV"} (indice mensile GME)`
          : null,
    });
  }
  return offers;
}

export const octopusScraper: BrandScraper = {
  brand: "octopus",
  supplier: "Octopus Energy",
  urls: [URL],
  parse: (texts) => parseOctopus(texts[0] ?? ""),
};
