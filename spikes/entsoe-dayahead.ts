/**
 * Spike ENTSO-E Transparency Platform — Day-ahead prices (documentType A44)
 *
 * Fonte: piattaforma ufficiale degli operatori europei dei sistemi di trasmissione
 * (https://transparency.entsoe.eu/). Endpoint Restful pubblico, autenticato con
 * `securityToken` (UUID rilasciato dietro registrazione gratuita).
 *
 *   Base URL : https://web-api.tp.entsoe.eu/api
 *   Auth     : query param `securityToken=<UUID>`
 *   Format   : XML (`Publication_MarketDocument` -> `TimeSeries` -> `Period` -> `Point[]`)
 *
 * Per il day-ahead (asta MGP-equivalente del singolo paese):
 *   documentType=A44
 *   in_Domain  = out_Domain = EIC della bidding zone
 *   periodStart, periodEnd  = YYYYMMDDHHmm in **UTC**
 *
 * Tipica periodicita`:
 *   - L'asta day-ahead chiude alle 12:00 CET; pubblica i prezzi del giorno seguente.
 *   - Se interroghiamo "oggi UTC -> domani UTC" prima della pubblicazione possiamo
 *     ricevere 200 con TimeSeries vuoto. In quel caso facciamo fallback a
 *     "ieri UTC -> oggi UTC" (giornata gia` regolata).
 *
 * Output:
 *   - main(): fetch 3 zone (DE_LU, FR, IT_NORTH), salva XML raw, scrive report.
 *   - parseEntsoeDayAhead(xml): parser puro testabile sul fixture committato.
 *
 * Attribuzione: i dati provengono da ENTSO-E Transparency Platform; l'uso e`
 * regolato dal "Terms and Conditions" della piattaforma e richiede attribuzione
 * (vedi spikes/samples/fixtures/entsoe-fixture-NOTES.md).
 */
import "dotenv/config";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { ENTSOE_DOMAINS, type EntsoeDomain } from "./lib/entsoe-domains.js";
import { saveSample, reportPath } from "./lib/save-sample.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TOKEN = process.env.ENTSOE_API_TOKEN;
if (!TOKEN) {
  console.error("[entsoe] Missing ENTSOE_API_TOKEN in .env — abort.");
  // Non usciamo qui se importati come modulo (test). Lo facciamo solo in main().
}

const ENTSOE_API_BASE = "https://web-api.tp.entsoe.eu/api";

const USER_AGENT =
  "EnergyIndex-Spike/0.1 (research; contact: commerciale@deagroup.biz)";

/** Le 3 zone obbligatorie per il piano (Italia Nord + 2 vicini chiave). */
const TARGET_DOMAINS: EntsoeDomain[] = ["DE_LU", "FR", "IT_NORTH"];

// ---------------------------------------------------------------------------
// Schemas (zod) — output del parser
// ---------------------------------------------------------------------------

const PointSchema = z.object({
  position: z.number().int().positive(),
  price: z.number(),
});

const ParseResultSchema = z.object({
  domain: z.string(),
  currency: z.string(),
  unit: z.string(),
  resolution: z.string(), // ISO 8601 duration, e.g. "PT60M"
  start: z.string(), // ISO timestamp (UTC) del Period
  end: z.string(), // ISO timestamp (UTC) del Period
  points: z.array(PointSchema),
});
export type EntsoeParseResult = z.infer<typeof ParseResultSchema>;

// ---------------------------------------------------------------------------
// URL + time helpers
// ---------------------------------------------------------------------------

export function buildDayAheadUrl(
  token: string,
  domain: string,
  periodStart: string,
  periodEnd: string,
): string {
  const params = new URLSearchParams({
    securityToken: token,
    documentType: "A44",
    in_Domain: domain,
    out_Domain: domain,
    periodStart,
    periodEnd,
  });
  return `${ENTSOE_API_BASE}?${params}`;
}

/** Format `YYYYMMDDHHmm` in UTC, come richiesto dall'API ENTSO-E. */
export function yyyymmddhhmmUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, "0");
  const D = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}${M}${D}${h}${m}`;
}

/** Restituisce un Date a 00:00 UTC del giorno passato (ignora ore/minuti). */
export function utcMidnight(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

// ---------------------------------------------------------------------------
// Pure parser (testabile sul fixture)
// ---------------------------------------------------------------------------

/**
 * Estrae i punti orari del prezzo day-ahead da una risposta XML
 * `Publication_MarketDocument` di ENTSO-E.
 *
 * Note:
 *  - In risposte multi-Period (caso DST: 23 o 25 punti), uniamo i Point di tutti
 *    i Period preservando la `position` rispetto al Period di provenienza.
 *  - In presenza di un solo Point l'XML parser di fast-xml-parser non crea un array,
 *    quindi normalizziamo sempre a Array.
 *  - currency_Unit.name e price_Measure_Unit.name a volte arrivano come "EUR"/"MWH",
 *    a volte come oggetti — gestiamo entrambi.
 */
export function parseEntsoeDayAhead(xml: string): EntsoeParseResult {
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: true,
    trimValues: true,
    // Lo schema ENTSO-E ha un namespace di default sul root; fast-xml-parser
    // non lo strippa di suo, ma siccome non ci interessano gli attributi
    // possiamo navigare direttamente per nome locale tag.
  });

  const parsed = parser.parse(xml) as Record<string, unknown>;

  const doc =
    (parsed["Publication_MarketDocument"] as Record<string, unknown>) ??
    // Fallback: alcune versioni dell'API potrebbero avere namespace prefix
    (Object.entries(parsed).find(([k]) =>
      k.endsWith(":Publication_MarketDocument"),
    )?.[1] as Record<string, unknown> | undefined);

  if (!doc) {
    // Caso di errore: ENTSO-E ritorna `Acknowledgement_MarketDocument` con motivo.
    const ack =
      (parsed["Acknowledgement_MarketDocument"] as Record<string, unknown>) ??
      undefined;
    if (ack) {
      const reason = (ack["Reason"] as Record<string, unknown>) ?? {};
      throw new Error(
        `[parseEntsoeDayAhead] Acknowledgement received (no data). ` +
          `Reason code=${String(reason["code"])} text=${String(reason["text"])}`,
      );
    }
    throw new Error(
      "[parseEntsoeDayAhead] root tag is not Publication_MarketDocument and not Acknowledgement_MarketDocument",
    );
  }

  // TimeSeries puo` essere singolo o array
  const tsRaw = doc["TimeSeries"];
  const tsList = Array.isArray(tsRaw)
    ? (tsRaw as Record<string, unknown>[])
    : tsRaw
      ? [tsRaw as Record<string, unknown>]
      : [];

  if (tsList.length === 0) {
    throw new Error("[parseEntsoeDayAhead] no TimeSeries in document");
  }

  // Per il day-ahead di una bidding zone normalmente c'e` un solo TimeSeries.
  // Se ce ne fossero piu` di uno (raro), prendiamo il primo "valido" (con Period).
  const ts =
    tsList.find((t) => t["Period"] !== undefined) ?? tsList[0];

  // Domain (in_Domain.mRID)
  const inDomain = ts["in_Domain.mRID"];
  const domain = typeof inDomain === "string" ? inDomain : String(inDomain ?? "");

  // currency_Unit.name e price_Measure_Unit.name
  const currency = String(ts["currency_Unit.name"] ?? "");
  const unit = String(ts["price_Measure_Unit.name"] ?? "");

  // Period: idem, puo` essere singolo o array.
  const periodRaw = ts["Period"];
  const periodList = Array.isArray(periodRaw)
    ? (periodRaw as Record<string, unknown>[])
    : [periodRaw as Record<string, unknown>];

  let resolution = "";
  let start = "";
  let end = "";
  const points: { position: number; price: number }[] = [];
  let positionOffset = 0;

  for (const period of periodList) {
    const interval = (period["timeInterval"] as Record<string, unknown>) ?? {};
    const periodStart = String(interval["start"] ?? "");
    const periodEnd = String(interval["end"] ?? "");
    const periodResolution = String(period["resolution"] ?? "");
    if (!start) start = periodStart;
    end = periodEnd; // sempre l'ultimo
    if (!resolution) resolution = periodResolution;

    const ptRaw = period["Point"];
    const ptList = Array.isArray(ptRaw)
      ? (ptRaw as Record<string, unknown>[])
      : ptRaw
        ? [ptRaw as Record<string, unknown>]
        : [];

    let maxPosInPeriod = 0;
    for (const pt of ptList) {
      const pos = Number(pt["position"]);
      const price = Number(pt["price.amount"]);
      if (!Number.isFinite(pos) || !Number.isFinite(price)) {
        throw new Error(
          `[parseEntsoeDayAhead] non-numeric point: position=${String(pt["position"])} price=${String(pt["price.amount"])}`,
        );
      }
      points.push({ position: positionOffset + pos, price });
      if (pos > maxPosInPeriod) maxPosInPeriod = pos;
    }
    positionOffset += maxPosInPeriod;
  }

  // Ordina per position (per sicurezza — ENTSO-E in genere li manda gia` ordinati)
  points.sort((a, b) => a.position - b.position);

  return ParseResultSchema.parse({
    domain,
    currency,
    unit,
    resolution,
    start,
    end,
    points,
  });
}

// ---------------------------------------------------------------------------
// Statistics helpers (per il report)
// ---------------------------------------------------------------------------

function priceStats(points: { position: number; price: number }[]): {
  n: number;
  min: number;
  median: number;
  max: number;
} {
  if (points.length === 0) return { n: 0, min: NaN, median: NaN, max: NaN };
  const v = points.map((p) => p.price).sort((a, b) => a - b);
  const median =
    v.length % 2 === 0
      ? (v[v.length / 2 - 1] + v[v.length / 2]) / 2
      : v[(v.length - 1) / 2];
  return { n: points.length, min: v[0], max: v[v.length - 1], median };
}

const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "—");

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

interface FetchOutcome {
  domain: EntsoeDomain;
  domainEic: string;
  url: string; // SENZA token (per il report)
  httpStatus: number;
  bytes: number;
  rawXml: string;
  parseOk: boolean;
  parseError?: string;
  result?: EntsoeParseResult;
  fellBack: boolean; // true se abbiamo dovuto usare ieri->oggi invece di oggi->domani
}

/** Fetch di una zona con retry sul rate-limit + fallback temporale. */
async function fetchOneDomain(
  token: string,
  domain: EntsoeDomain,
  todayUtcMidnight: Date,
): Promise<FetchOutcome> {
  const eic = ENTSOE_DOMAINS[domain];
  const tomorrow = new Date(todayUtcMidnight);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const yesterday = new Date(todayUtcMidnight);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  // Tentativo 1: oggi 00:00 UTC -> domani 00:00 UTC (24h day-ahead "del giorno")
  // Se torna empty/Acknowledgement, fallback a ieri 00:00 -> oggi 00:00
  const attempts: Array<{ start: Date; end: Date; label: string }> = [
    { start: todayUtcMidnight, end: tomorrow, label: "today->tomorrow" },
    { start: yesterday, end: todayUtcMidnight, label: "yesterday->today" },
  ];

  let lastUrlNoToken = "";
  let lastStatus = 0;
  let lastBytes = 0;
  let lastXml = "";
  let lastError: string | undefined;
  let fellBack = false;

  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    const periodStart = yyyymmddhhmmUtc(a.start);
    const periodEnd = yyyymmddhhmmUtc(a.end);
    const url = buildDayAheadUrl(token, eic, periodStart, periodEnd);
    // URL "redacted" per il report (no token)
    const urlNoToken =
      `${ENTSOE_API_BASE}?documentType=A44&in_Domain=${eic}&out_Domain=${eic}` +
      `&periodStart=${periodStart}&periodEnd=${periodEnd}&securityToken=<REDACTED>`;
    lastUrlNoToken = urlNoToken;

    let status = 0;
    let body = "";
    try {
      let res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/xml" },
      });
      // Retry su 429 dopo 1.5s
      if (res.status === 429) {
        await sleep(1500);
        res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/xml" },
        });
      }
      status = res.status;
      body = await res.text();
    } catch (e) {
      lastError = String(e);
      lastStatus = 0;
      lastBytes = 0;
      lastXml = "";
      continue;
    }

    lastStatus = status;
    lastBytes = body.length;
    lastXml = body;

    if (status !== 200) {
      lastError = `HTTP ${status}`;
      // Su 401 rompo subito: token non valido -> nessun fallback aiuta
      if (status === 401 || status === 403) break;
      continue;
    }

    // 200: prova a parsare. Se Acknowledgement (no data) -> tenta fallback.
    try {
      const result = parseEntsoeDayAhead(body);
      if (result.points.length === 0) {
        lastError = "TimeSeries presente ma 0 Point";
        if (i === 0) {
          fellBack = true;
          continue;
        }
      }
      // Successo
      return {
        domain,
        domainEic: eic,
        url: urlNoToken,
        httpStatus: status,
        bytes: lastBytes,
        rawXml: body,
        parseOk: true,
        result,
        fellBack: i > 0,
      };
    } catch (e) {
      const msg = String(e);
      lastError = msg;
      // Acknowledgement_MarketDocument -> nessun dato; fallback al tentativo successivo
      if (
        i === 0 &&
        (msg.includes("Acknowledgement") || msg.includes("no TimeSeries"))
      ) {
        fellBack = true;
        continue;
      }
      // Altri errori di parsing: ritorno la failure subito (non aiuta cambiare data)
      return {
        domain,
        domainEic: eic,
        url: urlNoToken,
        httpStatus: status,
        bytes: lastBytes,
        rawXml: body,
        parseOk: false,
        parseError: msg,
        fellBack: i > 0,
      };
    }
  }

  // Esauriti i tentativi senza successo
  return {
    domain,
    domainEic: eic,
    url: lastUrlNoToken,
    httpStatus: lastStatus,
    bytes: lastBytes,
    rawXml: lastXml,
    parseOk: false,
    parseError: lastError,
    fellBack,
  };
}

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error("[entsoe] Missing ENTSOE_API_TOKEN in .env");
    process.exit(1);
  }
  const token: string = TOKEN;

  const today = utcMidnight(new Date());
  const todayIso = today.toISOString().slice(0, 10);
  const reportFile = reportPath("entsoe");

  const reportLines: string[] = [];
  reportLines.push(`# Spike ENTSO-E day-ahead — ${todayIso} (UTC)`);
  reportLines.push("");
  reportLines.push(`- Endpoint: \`${ENTSOE_API_BASE}\``);
  reportLines.push(`- documentType: \`A44\` (day-ahead prices)`);
  reportLines.push(`- User-Agent: \`${USER_AGENT}\``);
  reportLines.push(
    `- Auth: query param \`securityToken=<REDACTED UUID dal .env>\``,
  );
  reportLines.push(
    `- Zone interrogate: ${TARGET_DOMAINS.map((d) => `\`${d}\` (${ENTSOE_DOMAINS[d]})`).join(", ")}`,
  );
  reportLines.push("");

  const outcomes: FetchOutcome[] = [];
  for (let i = 0; i < TARGET_DOMAINS.length; i++) {
    const dom = TARGET_DOMAINS[i];
    // 1s di pausa fra zone per evitare rate-limit (ENTSO-E ha caps mensili
    // ma anche limiti per-secondo non documentati con precisione)
    if (i > 0) await sleep(1000);
    try {
      const o = await fetchOneDomain(token, dom, today);
      outcomes.push(o);

      // Salva il raw XML (anche se il parser fallisce — utile per debug)
      const rawPath = `spikes/samples/raw/entsoe-${dom}-${todayIso}.xml`;
      await saveSample(rawPath, o.rawXml);
    } catch (e) {
      console.error(`[entsoe] ${dom} crashed:`, e);
      outcomes.push({
        domain: dom,
        domainEic: ENTSOE_DOMAINS[dom],
        url: "",
        httpStatus: 0,
        bytes: 0,
        rawXml: "",
        parseOk: false,
        parseError: String(e),
        fellBack: false,
      });
    }
  }

  // ---------- Tabella riepilogativa ----------
  reportLines.push(`## 1. Risultati richieste`);
  reportLines.push("");
  reportLines.push(
    `| zona | EIC | http | bytes | parser | n. Point | fallback ieri |`,
  );
  reportLines.push(`|---|---|---|---|---|---|---|`);
  for (const o of outcomes) {
    reportLines.push(
      `| ${o.domain} | \`${o.domainEic}\` | ${o.httpStatus} | ${o.bytes} | ${o.parseOk ? "OK" : "FAIL"} | ${o.result?.points.length ?? 0} | ${o.fellBack ? "si" : "no"} |`,
    );
  }
  reportLines.push("");

  // ---------- Statistiche prezzi ----------
  reportLines.push(`## 2. Statistiche prezzi (€/MWh)`);
  reportLines.push("");
  reportLines.push(`| zona | n | min | median | max | currency | unit | resolution |`);
  reportLines.push(`|---|---|---|---|---|---|---|---|`);
  for (const o of outcomes) {
    if (!o.result) {
      reportLines.push(
        `| ${o.domain} | 0 | — | — | — | — | — | — |`,
      );
      continue;
    }
    const s = priceStats(o.result.points);
    reportLines.push(
      `| ${o.domain} | ${s.n} | ${fmt(s.min)} | ${fmt(s.median)} | ${fmt(s.max)} | ${o.result.currency} | ${o.result.unit} | ${o.result.resolution} |`,
    );
  }
  reportLines.push("");

  // ---------- URL pattern ----------
  reportLines.push(`## 3. URL chiamate (token redacted)`);
  reportLines.push("");
  for (const o of outcomes) {
    reportLines.push(`- **${o.domain}**: \`${o.url}\``);
  }
  reportLines.push("");

  // ---------- Errori ----------
  const failures = outcomes.filter((o) => !o.parseOk);
  if (failures.length > 0) {
    reportLines.push(`## 4. Errori`);
    reportLines.push("");
    for (const o of failures) {
      reportLines.push(`### ${o.domain}`);
      reportLines.push("");
      reportLines.push("```");
      reportLines.push(o.parseError ?? "(unknown)");
      reportLines.push("```");
      reportLines.push("");
    }
  }

  // ---------- Verdetto ----------
  const successCount = outcomes.filter((o) => o.parseOk).length;
  const allOk = successCount === TARGET_DOMAINS.length;
  reportLines.push(`## ${failures.length > 0 ? 5 : 4}. Verdetto`);
  reportLines.push("");
  reportLines.push(
    allOk
      ? `- **ESITO: GO**. Token funzionante, ${successCount}/${TARGET_DOMAINS.length} zone parsate correttamente. ENTSO-E e` +
          ` adatto come fonte primaria per la mappa europea (Phase 2) e per il day-ahead di IT_NORTH.`
      : `- **ESITO: ATTENZIONE**. ${successCount}/${TARGET_DOMAINS.length} zone OK. Vedi sezione errori.`,
  );
  reportLines.push("");

  // ---------- Note operative ----------
  reportLines.push(`## Note operative`);
  reportLines.push("");
  reportLines.push(
    `- ENTSO-E richiede formato \`YYYYMMDDHHmm\` in **UTC** per \`periodStart\`/\`periodEnd\`. Usare ora locale italiana porta a 200 con TimeSeries vuoto o dati shiftati.`,
  );
  reportLines.push(
    `- L'asta day-ahead chiude alle 12:00 CET; i prezzi del giorno seguente sono pubblicati subito dopo. Se interroghiamo "oggi UTC -> domani UTC" prima della pubblicazione possiamo ricevere \`Acknowledgement_MarketDocument\` (no data). Lo spike fa fallback automatico a "ieri UTC -> oggi UTC".`,
  );
  reportLines.push(
    `- Giornate DST: la risposta puo` + ` contenere 23 o 25 \`Point\` invece di 24 (Europe/Rome cambia a fine marzo / fine ottobre). La nostra struttura preserva la \`position\` cosi` + ` come fornita dall'API.`,
  );
  reportLines.push(
    `- Rate limit: limiti per-secondo non documentati con precisione + cap mensile per token. Mettiamo 1s di pausa fra zone e retry singolo su 429.`,
  );
  reportLines.push(
    `- **Attribuzione**: i Terms of Use di ENTSO-E richiedono di citare "Source: ENTSO-E Transparency Platform" e di linkare alla home della piattaforma. Va aggiunto al footer dell'app Energy Index.`,
  );

  await saveSample(reportFile, reportLines.join("\n"));

  if (!allOk) {
    console.error(
      `[entsoe] ${failures.length} zone fallite, vedi report:`,
      reportFile,
    );
    process.exit(1);
  }
  console.log(
    `[entsoe] OK — ${successCount}/${TARGET_DOMAINS.length} zone, report:`,
    reportFile,
  );
}

// Esegui solo quando invocato come script (non quando importato dal test).
const invokedAsScript =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("entsoe-dayahead.ts");
if (invokedAsScript) {
  main().catch((err) => {
    console.error("[entsoe] FATAL", err);
    process.exit(1);
  });
}
