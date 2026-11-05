/**
 * Controllo della fonte sui siti che chiamano le API senza chiave: cerca un
 * link a energyindex.it nell'HTML della home. E' un controllo indicativo: una
 * fonte scritta via JavaScript o su un'altra pagina non si vede.
 */

import { hasEnergyIndexLink } from "./link-check";

export type SourceStatus = "link" | "testo" | "assente" | "errore";

export interface SourceCheck {
  site: string;
  status: SourceStatus;
  checked_at: string;
}

/** I riquadri incorporati (srcdoc) hanno l'HTML con le entita'. */
function decodeEntities(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function classifySource(html: string): Exclude<SourceStatus, "errore"> {
  // Script e stili vanno tolti: una stringa nel codice o in un tooltip non e' visibile a schermo.
  const page = decodeEntities(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  if (hasEnergyIndexLink(page)) return "link";
  return /energy\s*index/i.test(page.replace(/<[^>]*>/g, " ")) ? "testo" : "assente";
}

export interface SourceRunDeps {
  fetchHtml: (url: string) => Promise<string | null>;
  save: (check: SourceCheck) => Promise<void>;
  now?: () => Date;
}

export async function runSourceChecks(sites: string[], deps: SourceRunDeps) {
  const summary = { checked: 0, link: 0, testo: 0, assente: 0, errore: 0, saveErrors: 0 };
  for (const site of sites) {
    const html = await deps.fetchHtml(`https://${site}/`);
    const status: SourceStatus = html === null ? "errore" : classifySource(html);
    summary.checked += 1;
    summary[status] += 1;
    try {
      await deps.save({ site, status, checked_at: (deps.now?.() ?? new Date()).toISOString() });
    } catch {
      summary.saveErrors += 1;
    }
  }
  return summary;
}
