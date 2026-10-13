/**
 * Parser del dataset open data "Offerte Mercato Libero" del Portale Offerte
 * ARERA (XML giornaliero, schema SII_AU OffertaRetail/01): TUTTE le offerte
 * commerciali che i venditori pubblicano per obbligo di legge (L.124/2017).
 *
 * E' il livello "bulk" del canale online_brand (300+ venditori); lo scraping
 * diretto dei siti resta il livello di freschezza/verifica.
 *
 * Semantica campi (validata confrontando le offerte Octopus con i valori
 * scrapati dal sito: prezzo 0,165 €/kWh, spread 0,0088, comm. 72 €/anno):
 *   TIPO_MERCATO    01=electricity (file E), 02=gas (file G)
 *   TIPO_CLIENTE    01=domestico (altri = business/condominio, scartati)
 *   TIPO_OFFERTA    01=fisso, 02=variabile, 03=FLAT (scartata)
 *   IDX_PREZZO_ENERGIA  indice delle variabili; 12=PUN (dominante). Le
 *       variabili luce con altro indice vengono scartate per confrontabilita'
 *       dello spread; per il gas si tiene l'indice dominante del file.
 *   ComponenteImpresa TIPOLOGIA 01:
 *       UNITA_MISURA 03 (€/kWh) / 04 (€/Smc), MACROAREA != 01 → prezzo/spread
 *         (la MACROAREA della vendita non e' uniforme tra venditori: Octopus
 *          usa 06, altri 04 per la luce — si seleziona per unita' di misura)
 *       MACROAREA 01 + UNITA_MISURA 01 (€/anno) → commercializzazione
 *   Piu' PREZZO nella stessa componente = fasce F1/F2/F3 → media aritmetica.
 */

export interface MliberoOffer {
  codOfferta: string;
  piva: string;
  supplierDomain: string | null;  // da URL_SITO_VENDITORE, senza www.
  offerName: string;
  commodity: "electricity" | "gas";
  priceType: "fisso" | "variabile";
  priceValue: number;             // €/kWh | €/Smc (spread se variabile)
  fixedCostMonthly: number | null;
  idxPrezzo: string | null;
  validTo: string | null;         // YYYY-MM-DD
  sourceUrl: string | null;
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? m[1].trim() : null;
}

function parseDataFine(block: string): string | null {
  const v = block.match(/<DATA_FINE>(\d{2})\/(\d{2})\/(\d{4})_/);
  return v ? `${v[3]}-${v[2]}-${v[1]}` : null;
}

function normalizeDomain(url: string | null): string | null {
  if (!url) return null;
  const d = url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#\s]/)[0];
  return d || null;
}

interface Componente {
  tipologia: string | null;
  macroarea: string | null;
  prezzi: number[];
  unita: string[];
}

function parseComponenti(block: string): Componente[] {
  const out: Componente[] = [];
  for (const m of block.matchAll(/<ComponenteImpresa>([\s\S]*?)<\/ComponenteImpresa>/g)) {
    const c = m[1];
    out.push({
      tipologia: tag(c, "TIPOLOGIA"),
      macroarea: tag(c, "MACROAREA"),
      prezzi: [...c.matchAll(/<PREZZO>([^<]*)<\/PREZZO>/g)]
        .map((x) => Number(x[1]))
        .filter((n) => Number.isFinite(n)),
      unita: [...c.matchAll(/<UNITA_MISURA>([^<]*)<\/UNITA_MISURA>/g)].map((x) => x[1].trim()),
    });
  }
  return out;
}

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/**
 * Parsa un file XML MLIBERO (E o G). `commodity` deve corrispondere al file.
 * `allowedVarIdx`: codici IDX_PREZZO_ENERGIA accettati per le variabili
 * (null = tutti); per la luce usare ["12"] (PUN).
 */
export function parseMliberoXml(
  xml: string,
  commodity: "electricity" | "gas",
  allowedVarIdx: string[] | null,
): MliberoOffer[] {
  const vendUm = commodity === "electricity" ? "03" : "04";
  const offers: MliberoOffer[] = [];

  for (const m of xml.matchAll(/<offerta>([\s\S]*?)<\/offerta>/g)) {
    const b = m[1];
    if (tag(b, "TIPO_CLIENTE") !== "01") continue; // solo domestico

    const tipoOfferta = tag(b, "TIPO_OFFERTA");
    if (tipoOfferta !== "01" && tipoOfferta !== "02") continue; // no FLAT
    const priceType = tipoOfferta === "01" ? "fisso" : "variabile";

    const idx = tag(b, "IDX_PREZZO_ENERGIA");
    if (priceType === "variabile" && allowedVarIdx && (!idx || !allowedVarIdx.includes(idx)))
      continue;

    const cod = tag(b, "COD_OFFERTA");
    const nome = tag(b, "NOME_OFFERTA");
    if (!cod || !nome) continue;

    const comps = parseComponenti(b);
    const vend = comps.find(
      (c) =>
        c.tipologia === "01" &&
        c.macroarea !== "01" &&
        c.prezzi.length > 0 &&
        c.unita.includes(vendUm),
    );
    if (!vend) continue;

    // Commercializzazione: macroarea 01 in €/anno (UM 01) → €/mese.
    const comm = comps.find(
      (c) => c.tipologia === "01" && c.macroarea === "01" && c.prezzi.length > 0,
    );
    let fixedCostMonthly: number | null = null;
    if (comm) {
      const yearly = comm.unita[0] === "01";
      const v = avg(comm.prezzi);
      fixedCostMonthly = Math.round((yearly ? v / 12 : v) * 100) / 100;
    }

    offers.push({
      codOfferta: cod,
      piva: tag(b, "PIVA_UTENTE") ?? "",
      supplierDomain: normalizeDomain(tag(b, "URL_SITO_VENDITORE")),
      offerName: nome.replace(/\s+/g, " ").trim(),
      commodity,
      priceType,
      priceValue: Math.round(avg(vend.prezzi) * 1e6) / 1e6,
      fixedCostMonthly,
      idxPrezzo: idx,
      validTo: parseDataFine(b),
      sourceUrl: tag(b, "URL_SITO_VENDITORE")
        ? `https://${normalizeDomain(tag(b, "URL_SITO_VENDITORE"))}`
        : null,
    });
  }
  return offers;
}

/** Codice IDX piu' frequente tra le variabili di un file (per il gas). */
export function dominantVarIdx(xml: string): string | null {
  const counts = new Map<string, number>();
  for (const m of xml.matchAll(/<offerta>([\s\S]*?)<\/offerta>/g)) {
    const b = m[1];
    if (tag(b, "TIPO_CLIENTE") !== "01" || tag(b, "TIPO_OFFERTA") !== "02") continue;
    const idx = tag(b, "IDX_PREZZO_ENERGIA");
    if (idx) counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n];
  return best;
}

/** URL del file giornaliero MLIBERO (stesso pattern dello spike ARERA). */
export function buildMliberoXmlUrl(isoDate: string, variant: "E" | "G"): string {
  const [yyyy, mm, dd] = isoDate.split("-");
  const monthNoZero = String(parseInt(mm, 10));
  return `https://www.ilportaleofferte.it/portaleOfferte/resources/opendata/csv/offerteML/${yyyy}_${monthNoZero}/PO_Offerte_${variant}_MLIBERO_${yyyy}${mm}${dd}.xml`;
}
