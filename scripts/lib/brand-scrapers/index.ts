/**
 * Registry degli scraper brand attivi (fase 1: siti con prezzi in HTML
 * statico). Fase 2 (headless necessario): NeN, Sorgenia, listing Illumia.
 * Fase 3 (anti-bot): Enel, Plenitude, Edison, Engie, E.ON, A2A, Hera,
 * Acea, Iren, Dolomiti.
 */
import { octopusScraper } from "./octopus";
import { pulseeScraper } from "./pulsee";
import { illumiaScraper } from "./illumia";
import type { BrandScraper } from "./types";

export const BRAND_SCRAPERS: BrandScraper[] = [
  octopusScraper,
  pulseeScraper,
  illumiaScraper,
];
