/**
 * Spike ARERA Portale Offerte — Fase 0
 *
 * Verdetto: **Caso A — bulk pubblico disponibile**.
 *
 * Reality check (investigazione 2026-05-01, dettagli in `spikes/notes/arera-investigation.md`):
 *  - La pagina `https://www.ilportaleofferte.it/portaleOfferte/it/open-data.page` espone
 *    download diretti CSV (PLACET) e XML (Mercato Libero) **rigenerati ogni notte**
 *    (Last-Modified osservato 22:30-23:05 UTC).
 *  - Pattern URL stabile, deterministico:
 *      /portaleOfferte/resources/opendata/csv/{kind}/{YYYY}_{M}/PO_{file}_{YYYYMMDD}.{csv|xml}
 *    dove {M} e' senza zero leading (es. "5", non "05") e {YYYY}_{M} corrispondono al
 *    mese della data del file, non alla data corrente.
 *  - Il regime e' "open" ex L. 190/2012 + D.Lgs. 33/2013 (trasparenza PA): riutilizzo
 *    consentito, anche per servizi derivati come Energy Index.
 *  - Niente autenticazione, niente token, niente cookie speciali. Solo un User-Agent
 *    identificativo per cortesia.
 *
 * Output:
 *  - main(): scarica i 4 file PLACET del giorno (E offerte, G offerte, E parametri,
 *    G parametri), salva i raw, fa il parsing, scrive un report con stats per i 4
 *    aggregati Energy Index (Fisse Luce, Variabili Luce, Fisse Gas, Variabili Gas).
 *  - parsePlacetElectric / parsePlacetGas: parser puri testabili sui fixture commitati.
 */
import "dotenv/config";
import { saveSample, todayIsoDate, reportPath } from "./lib/save-sample.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type AreraAccessCase =
  | "A_bulk_public"
  | "B_html_scraping_required"
  | "C_authenticated_only";

/** Determinato dall'investigazione 2026-05-01 (vedi spikes/notes/arera-investigation.md). */
const CASE: AreraAccessCase = "A_bulk_public";

const BASE = "https://www.ilportaleofferte.it";
const USER_AGENT =
  "EnergyIndex-Spike/0.1 (research; contact: commerciale@deagroup.biz)";

/** Costruisce l'URL deterministico per uno snapshot PLACET o ML in una data. */
export function buildPlacetUrl(
  isoDate: string, // YYYY-MM-DD
  variant: "E_offerte" | "G_offerte" | "E_parametri" | "G_parametri",
): string {
  const [yyyy, mm, dd] = isoDate.split("-");
  const monthNoZero = String(parseInt(mm, 10));
  const compact = `${yyyy}${mm}${dd}`;
  switch (variant) {
    case "E_offerte":
      return `${BASE}/portaleOfferte/resources/opendata/csv/offerte/${yyyy}_${monthNoZero}/PO_Offerte_E_PLACET_${compact}.csv`;
    case "G_offerte":
      return `${BASE}/portaleOfferte/resources/opendata/csv/offerte/${yyyy}_${monthNoZero}/PO_Offerte_G_PLACET_${compact}.csv`;
    case "E_parametri":
      return `${BASE}/portaleOfferte/resources/opendata/csv/parametri/${yyyy}_${monthNoZero}/PO_Parametri_E_${compact}.csv`;
    case "G_parametri":
      return `${BASE}/portaleOfferte/resources/opendata/csv/parametri/${yyyy}_${monthNoZero}/PO_Parametri_G_${compact}.csv`;
  }
}

export function buildMliberoUrl(
  isoDate: string,
  variant: "E" | "G" | "D",
): string {
  const [yyyy, mm, dd] = isoDate.split("-");
  const monthNoZero = String(parseInt(mm, 10));
  const compact = `${yyyy}${mm}${dd}`;
  return `${BASE}/portaleOfferte/resources/opendata/csv/offerteML/${yyyy}_${monthNoZero}/PO_Offerte_${variant}_MLIBERO_${compact}.xml`;
}

// ---------------------------------------------------------------------------
// Parsers (puri, testabili)
// ---------------------------------------------------------------------------

/**
 * Schema PLACET elettrico (snapshot 2026-05-01): 26 colonne, separatore ',',
 * nessuna virgola embedded (verificato su 909 righe). Numeri con punto decimale.
 *
 * Indici di colonna 0-based per i campi rilevanti per Energy Index.
 */
const PLACET_E_COLS = {
  denominazione: 0,
  codice_offerta: 6,
  data_inizio: 10,
  data_fine: 11,
  tipo_cliente: 12,
  tipo_offerta: 13,
  p_fix_f: 14,
  p_fix_v: 15,
  p_vol_f1: 16,
  p_vol_f2: 17,
  p_vol_f3: 18,
  p_vol_bf1: 19,
  p_vol_bf23: 20,
  p_vol_mono: 21,
  alpha: 22,
} as const;

const PLACET_G_COLS = {
  denominazione: 0,
  codice_offerta: 6,
  data_inizio: 10,
  data_fine: 11,
  tipo_cliente: 12,
  tipo_offerta: 13,
  p_fix_f: 14,
  p_fix_v: 15,
  p_vol: 16,
  alpha: 17,
} as const;

export interface PlacetOffer {
  vendor: string;
  codice: string;
  data_inizio: string; // gg/mm/yyyy
  data_fine: string;
  tipo_cliente: string;
  tipo_offerta: "prezzo fisso" | "prezzo variabile" | string;
  /** Quota fissa annua applicata (qualunque dei p_fix_*). NaN se non specificata. */
  quota_fissa_eur_anno: number;
  /**
   * Prezzo "energia" comparabile, in EUR/kWh per elettrico, EUR/Smc per gas:
   *  - elettrico fisso: p_vol_mono (preferito) oppure media di p_vol_f1..f3
   *  - elettrico variabile: alpha (lo spread sull'indice e' il valore comparabile)
   *  - gas fisso: p_vol
   *  - gas variabile: alpha
   * NaN se non determinabile.
   */
  prezzo_energia: number;
}

/** Parsa il CSV PLACET elettrico (26 colonne). */
export function parsePlacetElectric(csvText: string): PlacetOffer[] {
  return parsePlacetGeneric(csvText, "electric");
}

/** Parsa il CSV PLACET gas (21 colonne). */
export function parsePlacetGas(csvText: string): PlacetOffer[] {
  return parsePlacetGeneric(csvText, "gas");
}

function parsePlacetGeneric(
  csvText: string,
  kind: "electric" | "gas",
): PlacetOffer[] {
  const expectedFields = kind === "electric" ? 26 : 21;
  const cols = kind === "electric" ? PLACET_E_COLS : PLACET_G_COLS;
  // Normalizza CRLF/LF e rimuovi BOM se presente.
  const text = csvText.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const rawLines = text.split("\n").filter((l) => l.length > 0);
  if (rawLines.length === 0) return [];

  // Riga 0 = header. Verifica che il numero di campi sia atteso (sanity check).
  const headerCols = rawLines[0].split(",");
  if (headerCols.length !== expectedFields) {
    throw new Error(
      `[parsePlacet${kind}] schema inatteso: header ha ${headerCols.length} campi, attesi ${expectedFields}.` +
        ` Header: ${rawLines[0].slice(0, 200)}`,
    );
  }

  const out: PlacetOffer[] = [];
  for (let i = 1; i < rawLines.length; i++) {
    const fields = rawLines[i].split(",");
    if (fields.length !== expectedFields) {
      throw new Error(
        `[parsePlacet${kind}] riga ${i + 1} ha ${fields.length} campi (attesi ${expectedFields})`,
      );
    }
    const tipo_offerta = fields[cols.tipo_offerta];
    const quota = pickNumber(
      fields[cols.p_fix_f],
      fields[cols.p_fix_v],
    );

    let prezzo_energia: number;
    if (kind === "electric") {
      const ec = cols as typeof PLACET_E_COLS;
      if (tipo_offerta === "prezzo fisso") {
        // Preferisci il monorario; in subordine media di f1..f3 non vuoti.
        const mono = parseNumOrNaN(fields[ec.p_vol_mono]);
        if (Number.isFinite(mono)) {
          prezzo_energia = mono;
        } else {
          const fasce = [
            fields[ec.p_vol_f1],
            fields[ec.p_vol_f2],
            fields[ec.p_vol_f3],
          ]
            .map(parseNumOrNaN)
            .filter((n) => Number.isFinite(n));
          prezzo_energia =
            fasce.length > 0
              ? fasce.reduce((s, x) => s + x, 0) / fasce.length
              : NaN;
        }
      } else {
        // Variabile: alpha (lo spread €/kWh sull'indice)
        prezzo_energia = parseNumOrNaN(fields[ec.alpha]);
      }
    } else {
      const gc = cols as typeof PLACET_G_COLS;
      if (tipo_offerta === "prezzo fisso") {
        prezzo_energia = parseNumOrNaN(fields[gc.p_vol]);
      } else {
        prezzo_energia = parseNumOrNaN(fields[gc.alpha]);
      }
    }

    out.push({
      vendor: fields[cols.denominazione],
      codice: fields[cols.codice_offerta],
      data_inizio: fields[cols.data_inizio],
      data_fine: fields[cols.data_fine],
      tipo_cliente: fields[cols.tipo_cliente],
      tipo_offerta,
      quota_fissa_eur_anno: quota,
      prezzo_energia,
    });
  }
  return out;
}

function parseNumOrNaN(raw: string | undefined): number {
  if (raw == null || raw === "") return NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

/** Restituisce il primo campo numerico parseabile, NaN se nessuno. */
function pickNumber(...candidates: (string | undefined)[]): number {
  for (const c of candidates) {
    const n = parseNumOrNaN(c);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

// ---------------------------------------------------------------------------
// Aggregati Energy Index
// ---------------------------------------------------------------------------

export interface AggregateStats {
  n: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

/** Quantile con interpolazione lineare. q in [0,1], xs deve essere ordinato. */
function quantile(xsSorted: number[], q: number): number {
  if (xsSorted.length === 0) return NaN;
  if (xsSorted.length === 1) return xsSorted[0];
  const pos = (xsSorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return xsSorted[lo];
  return xsSorted[lo] + (xsSorted[hi] - xsSorted[lo]) * (pos - lo);
}

export function statsFor(offers: PlacetOffer[]): AggregateStats {
  const xs = offers
    .map((o) => o.prezzo_energia)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  return {
    n: xs.length,
    min: xs.length ? xs[0] : NaN,
    p25: quantile(xs, 0.25),
    median: quantile(xs, 0.5),
    p75: quantile(xs, 0.75),
    max: xs.length ? xs[xs.length - 1] : NaN,
  };
}

// ---------------------------------------------------------------------------
// HTTP fetch
// ---------------------------------------------------------------------------

interface FetchResult {
  url: string;
  status: number;
  contentType: string;
  bytes: number;
  body: string;
}

async function fetchText(url: string): Promise<FetchResult> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  const body = await res.text();
  return {
    url,
    status: res.status,
    contentType: res.headers.get("content-type") ?? "",
    bytes: body.length,
    body,
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const isoDate = process.env.SPIKE_DATE_OVERRIDE ?? todayIsoDate();
  const lines: string[] = [];
  lines.push(`# Spike ARERA Portale Offerte — ${todayIsoDate()}`);
  lines.push("");
  lines.push(`- Verdetto: **${CASE}**`);
  lines.push(`- Data snapshot richiesta: \`${isoDate}\``);
  lines.push(`- User-Agent: \`${USER_AGENT}\``);
  lines.push(`- Note investigative: \`spikes/notes/arera-investigation.md\``);
  lines.push("");

  if (CASE !== "A_bulk_public") {
    // Stub di compatibilita: se mai il verdetto cambiasse, lo spike documenta e termina.
    lines.push(`## Bulk pubblico non disponibile`);
    lines.push("");
    lines.push(
      `Vedi \`spikes/notes/arera-investigation.md\` per il piano-B raccomandato.`,
    );
    await saveSample(reportPath("arera"), lines.join("\n"));
    return;
  }

  // ---- Caso A: scarica e parsifica i 4 file PLACET ----------------------

  const targets = [
    {
      label: "PLACET Elettrico (offerte)",
      url: buildPlacetUrl(isoDate, "E_offerte"),
      kind: "csv-electric" as const,
    },
    {
      label: "PLACET Gas (offerte)",
      url: buildPlacetUrl(isoDate, "G_offerte"),
      kind: "csv-gas" as const,
    },
    {
      label: "PLACET Elettrico (parametri)",
      url: buildPlacetUrl(isoDate, "E_parametri"),
      kind: "params" as const,
    },
    {
      label: "PLACET Gas (parametri)",
      url: buildPlacetUrl(isoDate, "G_parametri"),
      kind: "params" as const,
    },
  ];

  // Sondaggio aggiuntivo: HEAD sui 3 file Mercato Libero, solo per documentazione.
  const mliberoUrls = [
    { label: "Mercato Libero Elettrico (XML)", url: buildMliberoUrl(isoDate, "E") },
    { label: "Mercato Libero Gas (XML)", url: buildMliberoUrl(isoDate, "G") },
    { label: "Mercato Libero Dual Fuel (XML)", url: buildMliberoUrl(isoDate, "D") },
  ];

  lines.push(`## 1. Download file PLACET`);
  lines.push("");
  lines.push(`| file | url | http | content-type | bytes |`);
  lines.push(`|---|---|---|---|---|`);

  const results: { label: string; res: FetchResult; kind: string }[] = [];
  for (const t of targets) {
    const res = await fetchText(t.url);
    results.push({ label: t.label, res, kind: t.kind });
    lines.push(
      `| ${t.label} | \`${shorten(t.url)}\` | ${res.status} | ${res.contentType} | ${res.bytes} |`,
    );
    // Salva i raw nei sample (gitignored)
    const fileExt = t.url.endsWith(".csv") ? "csv" : "xml";
    await saveSample(`spikes/samples/raw/arera-${pathLabel(t.label)}-${isoDate}.${fileExt}`, res.body);
  }
  lines.push("");

  // 2. HEAD sui Mercato Libero (per documentazione: NON li scarichiamo nello spike,
  //    sono 30+ MB e per Fase 0 e' sufficiente sapere che esistono e rispondono 200).
  lines.push(`## 2. Mercato Libero — verifica esistenza (HEAD)`);
  lines.push("");
  lines.push(`| file | url | http | content-type | content-length |`);
  lines.push(`|---|---|---|---|---|`);
  for (const t of mliberoUrls) {
    try {
      const r = await fetch(t.url, {
        method: "HEAD",
        headers: { "User-Agent": USER_AGENT },
      });
      const cl = r.headers.get("content-length") ?? "?";
      const ct = r.headers.get("content-type") ?? "?";
      lines.push(`| ${t.label} | \`${shorten(t.url)}\` | ${r.status} | ${ct} | ${cl} |`);
    } catch (err) {
      lines.push(`| ${t.label} | \`${shorten(t.url)}\` | ERROR | - | ${String(err)} |`);
    }
  }
  lines.push("");

  // 3. Parser + statistiche aggregate per Energy Index
  lines.push(`## 3. Parser PLACET + aggregati Energy Index`);
  lines.push("");

  const electricResult = results.find((r) => r.kind === "csv-electric")!;
  const gasResult = results.find((r) => r.kind === "csv-gas")!;

  let placetE: PlacetOffer[] = [];
  let placetG: PlacetOffer[] = [];
  let parserOk = false;
  let parserErr = "";
  try {
    if (electricResult.res.status === 200) {
      placetE = parsePlacetElectric(electricResult.res.body);
    }
    if (gasResult.res.status === 200) {
      placetG = parsePlacetGas(gasResult.res.body);
    }
    parserOk = true;
  } catch (err) {
    parserErr = String(err);
  }
  lines.push(`- parser PLACET OK: \`${parserOk}\``);
  if (!parserOk) {
    lines.push("```");
    lines.push(parserErr);
    lines.push("```");
  }
  lines.push(`- offerte elettriche parsate: \`${placetE.length}\``);
  lines.push(`- offerte gas parsate: \`${placetG.length}\``);
  lines.push("");

  if (parserOk) {
    const fissoLuce = placetE.filter((o) => o.tipo_offerta === "prezzo fisso");
    const variabileLuce = placetE.filter(
      (o) => o.tipo_offerta === "prezzo variabile",
    );
    const fissoGas = placetG.filter((o) => o.tipo_offerta === "prezzo fisso");
    const variabileGas = placetG.filter(
      (o) => o.tipo_offerta === "prezzo variabile",
    );

    const fmtRow = (label: string, unit: string, s: AggregateStats) =>
      `| ${label} | ${s.n} | ${fmt(s.min)} | ${fmt(s.p25)} | ${fmt(s.median)} | ${fmt(s.p75)} | ${fmt(s.max)} | ${unit} |`;

    lines.push(`### Aggregati per i 4 indici Energy Index`);
    lines.push("");
    lines.push(`| metrica | n | min | p25 | mediana | p75 | max | unita |`);
    lines.push(`|---|---|---|---|---|---|---|---|`);
    lines.push(fmtRow("Fisse Luce (p_vol_mono)", "EUR/kWh", statsFor(fissoLuce)));
    lines.push(fmtRow("Variabili Luce (alpha)", "EUR/kWh", statsFor(variabileLuce)));
    lines.push(fmtRow("Fisse Gas (p_vol)", "EUR/Smc", statsFor(fissoGas)));
    lines.push(fmtRow("Variabili Gas (alpha)", "EUR/Smc", statsFor(variabileGas)));
    lines.push("");
  }

  // 4. Verdetto finale
  const allFetched = results.every((r) => r.res.status === 200);
  const enoughSample = placetE.length >= 100 && placetG.length >= 100;
  const ok = allFetched && parserOk && enoughSample;

  lines.push(`## 4. Verdetto`);
  lines.push("");
  if (ok) {
    lines.push(
      `- ESITO: GO. Bulk pubblico funzionante, schema mappato, parser produce 4 aggregati Energy Index direttamente dai dati PLACET ufficiali ARERA.`,
    );
  } else {
    lines.push(
      `- ESITO: ATTENZIONE. allFetched=${allFetched} parserOk=${parserOk} enoughSample=${enoughSample}. ` +
        `Possibile che la data di snapshot non sia ancora pubblicata (i file vengono rigenerati la notte). ` +
        `Riprovare con SPIKE_DATE_OVERRIDE=YYYY-MM-DD impostato a una data passata.`,
    );
  }
  lines.push("");
  lines.push(`## Note operative per Fase 1`);
  lines.push("");
  lines.push(
    `- **MVP**: bastano i 2 CSV PLACET (offerte E + G) per produrre i 4 indici Energy Index. Niente nuove dipendenze npm. Parsing in <100 righe di TS.`,
  );
  lines.push(
    `- **Estensione**: il Mercato Libero XML (28 MB combinato) richiede \`fast-xml-parser\` (gia in dependencies) e mappatura piu complessa di \`<ComponenteImpresa>\` con fasce orarie. Lavoro stimato 1-2 giorni.`,
  );
  lines.push(
    `- **Schedulazione**: cron settimanale lunedi mattina alle 06:00 UTC e' sufficiente — i file sono freschi dalla notte precedente. Idempotente per ETag/Last-Modified.`,
  );
  lines.push(
    `- **Licenza/uso**: regime "open" L. 190/2012 + D.Lgs. 33/2013 (vedi note). Citare "Fonte: Portale Offerte — Acquirente Unico S.p.A. — ARERA" nella UI.`,
  );

  await saveSample(reportPath("arera"), lines.join("\n"));

  if (!ok) {
    console.error(
      "[arera] verifica manualmente — vedi report. Provare SPIKE_DATE_OVERRIDE su una data passata.",
    );
    process.exit(1);
  }
  console.log("[arera] OK — Caso A confermato. Vedi report e investigation note.");
}

function fmt(x: number): string {
  return Number.isFinite(x) ? x.toFixed(6) : "—";
}

function shorten(url: string): string {
  return url.replace(BASE, "");
}

function pathLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Esegui solo quando invocato come script (non quando importato dal test).
const invokedAsScript =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("arera-offers.ts");
if (invokedAsScript) {
  main().catch((err) => {
    console.error("[arera] FAILED:", err);
    process.exit(1);
  });
}
