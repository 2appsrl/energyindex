/**
 * Spike GME PUN — Fase 0
 *
 * Verifica accessibilità pubblica degli esiti MGP del giorno (PUN Index GME + 6 zone fisiche).
 *
 * Reality check (investigazione 2026-05-01):
 *  - Le URL del piano (DatiSintesi.aspx, EsitiXML.aspx) NON esistono più (404).
 *  - Il sito GME è stato rifatto con DotNetNuke + un modulo Angular `GmeEsitiPrezziME`.
 *  - I dati sono esposti via JSON (NON XML/Excel) tramite Web API DNN protetta da
 *    anti-forgery token + headers DNN (TabId, ModuleId, RequestVerificationToken).
 *  - Endpoint reale (no auth utente, ma serve scraping del token dalla pagina contenitore):
 *      GET /DesktopModules/GmeEsitiPrezziME/API/item/GetMEPrezzi
 *           ?DataInizio=YYYYMMDD&DataFine=YYYYMMDD
 *           &Granularita=h&Mercato=MGP&Zona=<PUN|NORD|...>&Tipologia=PUN
 *  - Risposta: array di {df, h, p, qh} dove df=data flusso, h=ora 1..24, p=prezzo €/MWh,
 *    qh=indice quarto d'ora (4 per ogni ora — i prezzi orari sono comunque restituiti).
 *  - PUN è dal 1° gennaio 2025 il "PUN Index GME" (media ponderata) ma è esposto come Zona=PUN.
 *
 * Output del modulo:
 *  - main(): script entrypoint, salva sample+report.
 *  - parseGmePun(rawContent: string): parser puro testabile sul fixture committato.
 */
import { saveSample, todayIsoDate, reportPath } from "./lib/save-sample.js";
import { z } from "zod";

const USER_AGENT =
  "EnergyIndex-Spike/0.1 (research; contact: commerciale@deagroup.biz)";

const BASE = "https://www.mercatoelettrico.org";
const PAGE_PATH = "/it-it/Home/Esiti/Elettricita/MGP/Esiti/PUN";

/** I 6 codici zona fisici richiesti dal piano. */
const PHYSICAL_ZONES = ["NORD", "CNOR", "CSUD", "SUD", "SICI", "SARD"] as const;
type PhysicalZone = (typeof PHYSICAL_ZONES)[number];

// ---------------------------------------------------------------------------
// Schemas (zod)
// ---------------------------------------------------------------------------

/**
 * Riga raw del backend GME: numeri arrivano già come number JSON (non stringhe).
 * Resta uno schema esplicito per rilevare regressioni.
 */
const GmeRowSchema = z.object({
  df: z.number().int(), // data flusso YYYYMMDD
  h: z.number().int().min(1).max(25), // 1..24 (25 il giorno DST in autunno)
  p: z.number(), // prezzo €/MWh
  qh: z.number().int().optional(),
});
type GmeRow = z.infer<typeof GmeRowSchema>;

/** Forma del file combinato che salviamo come fixture. */
const CombinedSampleSchema = z.object({
  source: z.literal("gme-mgp-pun"),
  url_base: z.string(),
  fetched_at: z.string(),
  data_date: z.string(), // YYYY-MM-DD
  pun: z.array(GmeRowSchema),
  zones: z.record(z.string(), z.array(GmeRowSchema)),
});
type CombinedSample = z.infer<typeof CombinedSampleSchema>;

/** Output del parser: forma normalizzata definita dal piano. */
const HourlyPointSchema = z.object({
  hour: z.number().int().min(1).max(25),
  value: z.number(),
});
const ParseResultSchema = z.object({
  pun_national: z.array(HourlyPointSchema),
  zonal: z.object({
    NORD: z.array(HourlyPointSchema),
    CNOR: z.array(HourlyPointSchema),
    CSUD: z.array(HourlyPointSchema),
    SUD: z.array(HourlyPointSchema),
    SICI: z.array(HourlyPointSchema),
    SARD: z.array(HourlyPointSchema),
  }),
});
export type ParseResult = z.infer<typeof ParseResultSchema>;

// ---------------------------------------------------------------------------
// Pure parser (testabile su fixture)
// ---------------------------------------------------------------------------

/**
 * Parsa il sample combinato JSON salvato dallo spike.
 * Ritorna 24 punti PUN nazionali + 24 punti × 6 zone fisiche.
 */
export function parseGmePun(rawContent: string): ParseResult {
  const json = JSON.parse(rawContent) as unknown;
  const sample = CombinedSampleSchema.parse(json);

  const toPoints = (rows: GmeRow[]) =>
    rows
      .slice()
      .sort((a, b) => a.h - b.h)
      .map((r) => ({ hour: r.h, value: r.p }));

  const pun_national = toPoints(sample.pun);

  const zonal = {} as ParseResult["zonal"];
  for (const code of PHYSICAL_ZONES) {
    const rows = sample.zones[code];
    if (!rows) {
      throw new Error(`[parseGmePun] zona ${code} mancante nel sample`);
    }
    (zonal as Record<PhysicalZone, { hour: number; value: number }[]>)[code] =
      toPoints(rows);
  }

  return ParseResultSchema.parse({ pun_national, zonal });
}

// ---------------------------------------------------------------------------
// HTTP helpers (solo per main())
// ---------------------------------------------------------------------------

interface DnnSession {
  cookieHeader: string;
  rvt: string;
  moduleId: string;
  tabId: string;
}

/**
 * Scarica la pagina contenitore PUN e ne estrae cookie ASP.NET +
 * RequestVerificationToken + ModuleId + TabId, necessari per chiamare la Web API.
 */
async function bootstrapSession(): Promise<{
  session: DnnSession;
  pageStatus: number;
  pageBytes: number;
}> {
  const res = await fetch(BASE + PAGE_PATH, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    redirect: "follow",
  });
  const html = await res.text();
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const cookieHeader = setCookies
    .map((c) => c.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");

  const rvtMatch = html.match(
    /name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/,
  );
  const moduleIdMatch = html.match(/"ModuleId":(\d+)/);
  const tabIdMatch = html.match(/"TabId":(\d+)/);

  if (!rvtMatch || !moduleIdMatch || !tabIdMatch) {
    throw new Error(
      `[bootstrapSession] estrazione token DNN fallita ` +
        `(rvt=${!!rvtMatch} moduleId=${!!moduleIdMatch} tabId=${!!tabIdMatch}). ` +
        `Forse la pagina ha cambiato struttura.`,
    );
  }

  return {
    session: {
      cookieHeader,
      rvt: rvtMatch[1],
      moduleId: moduleIdMatch[1],
      tabId: tabIdMatch[1],
    },
    pageStatus: res.status,
    pageBytes: html.length,
  };
}

/** Wrapper su fetch verso Web API DNN con headers anti-forgery. */
async function callDnnApi(
  session: DnnSession,
  path: string,
  query: Record<string, string>,
): Promise<{ status: number; body: string }> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/plain, */*",
      Cookie: session.cookieHeader,
      RequestVerificationToken: session.rvt,
      ModuleId: session.moduleId,
      TabId: session.tabId,
      userid: "-1",
      Referer: BASE + PAGE_PATH,
    },
  });
  return { status: res.status, body: await res.text() };
}

function isoToCompact(iso: string): string {
  return iso.replace(/-/g, "");
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Permetti override per generare fixture su un giorno passato (utile in CI/test).
  // Esempio: SPIKE_DATE_OVERRIDE=2026-04-30 npm run spike:gme-pun
  const override = process.env.SPIKE_DATE_OVERRIDE;
  const isoDate = override ?? todayIsoDate();
  const compactDate = isoToCompact(isoDate);
  const reportFile = reportPath("gme-pun");
  const rawJsonPath = `spikes/samples/raw/gme-pun-${isoDate}.json`;
  const rawHtmlPath = `spikes/samples/raw/gme-pun-page-${isoDate}.html`;

  const reportLines: string[] = [];
  reportLines.push(`# Spike GME PUN — ${isoDate}`);
  reportLines.push("");
  reportLines.push(`- User-Agent: \`${USER_AGENT}\``);
  reportLines.push(`- Pagina contenitore: \`${BASE}${PAGE_PATH}\``);
  reportLines.push(
    `- Endpoint dati: \`${BASE}/DesktopModules/GmeEsitiPrezziME/API/item/GetMEPrezzi\``,
  );
  reportLines.push("");

  // 1) Bootstrap DNN session
  let session: DnnSession;
  let pageStatus = 0;
  let pageBytes = 0;
  try {
    const r = await bootstrapSession();
    session = r.session;
    pageStatus = r.pageStatus;
    pageBytes = r.pageBytes;
    reportLines.push(`## 1. Pagina contenitore`);
    reportLines.push("");
    reportLines.push(`- HTTP status: \`${pageStatus}\``);
    reportLines.push(`- Bytes HTML: \`${pageBytes}\``);
    reportLines.push(`- TabId: \`${session.tabId}\` ModuleId: \`${session.moduleId}\``);
    reportLines.push(`- Token estratto: si`);
    reportLines.push("");
  } catch (err) {
    reportLines.push(`## 1. Pagina contenitore — ERRORE`);
    reportLines.push("");
    reportLines.push("```");
    reportLines.push(String(err));
    reportLines.push("```");
    reportLines.push("");
    await saveSample(reportFile, reportLines.join("\n"));
    console.error("[gme-pun] bootstrap fallito:", err);
    process.exit(1);
  }

  // 2) Fetch PUN nazionale + 6 zone fisiche.
  //    Provo prima oggi; se vuoto fallback a ieri (l'asta MGP chiude alle ~12:30 e
  //    pubblica i prezzi del giorno seguente — quindi entrambi possono essere validi).
  reportLines.push(`## 2. Chiamate API`);
  reportLines.push("");
  reportLines.push(`| zona | data flusso | http | bytes | n. righe |`);
  reportLines.push(`|---|---|---|---|---|`);

  async function fetchZone(zona: string, date: string) {
    // PUN nazionale -> Tipologia=PUN; le 6 zone fisiche -> Tipologia=PrezziZonali.
    // Se invocato con Tipologia=PUN su una zona qualsiasi il backend ignora la zona e
    // restituisce sempre il PUN nazionale (verificato 2026-05-01).
    const tipologia = zona === "PUN" ? "PUN" : "PrezziZonali";
    const { status, body } = await callDnnApi(
      session,
      "/DesktopModules/GmeEsitiPrezziME/API/item/GetMEPrezzi",
      {
        DataInizio: date,
        DataFine: date,
        Granularita: "h",
        Mercato: "MGP",
        Zona: zona,
        Tipologia: tipologia,
      },
    );
    let parsed: GmeRow[] = [];
    if (status === 200) {
      try {
        const arr = JSON.parse(body);
        if (Array.isArray(arr)) parsed = arr.map((r) => GmeRowSchema.parse(r));
      } catch {
        // lascia parsed vuoto, riportato nel report
      }
    }
    return { status, body, rows: parsed };
  }

  const candidateDates = [compactDate, isoToCompact(yesterdayIso(isoDate))];
  let dataDateCompact = compactDate;
  let punResult = await fetchZone("PUN", dataDateCompact);
  if (punResult.rows.length === 0 && candidateDates[1] !== candidateDates[0]) {
    dataDateCompact = candidateDates[1];
    punResult = await fetchZone("PUN", dataDateCompact);
  }
  reportLines.push(
    `| PUN | ${dataDateCompact} | ${punResult.status} | ${punResult.body.length} | ${punResult.rows.length} |`,
  );

  const zoneResults: Record<string, GmeRow[]> = {};
  for (const z of PHYSICAL_ZONES) {
    const r = await fetchZone(z, dataDateCompact);
    zoneResults[z] = r.rows;
    reportLines.push(
      `| ${z} | ${dataDateCompact} | ${r.status} | ${r.body.length} | ${r.rows.length} |`,
    );
  }
  reportLines.push("");

  // 3) Salva sample combinato + raw HTML pagina (per debug futuro).
  const dataDateIso = `${dataDateCompact.slice(0, 4)}-${dataDateCompact.slice(4, 6)}-${dataDateCompact.slice(6, 8)}`;
  const combined: CombinedSample = {
    source: "gme-mgp-pun",
    url_base: BASE,
    fetched_at: new Date().toISOString(),
    data_date: dataDateIso,
    pun: punResult.rows,
    zones: zoneResults,
  };
  await saveSample(rawJsonPath, JSON.stringify(combined, null, 2));
  // Salviamo solo un piccolo header HTML per non gonfiare (è gitignored, ma utile a futuri spike)
  await saveSample(rawHtmlPath, `<!-- bootstrap page snapshot, ${pageBytes} bytes -->`);

  // 4) Validazione strutturale + range
  reportLines.push(`## 3. Parser + validazione`);
  reportLines.push("");
  let parserOk = false;
  let parserMsg = "";
  let parsed: ParseResult | null = null;
  try {
    parsed = parseGmePun(JSON.stringify(combined));
    parserOk = true;
  } catch (err) {
    parserMsg = String(err);
  }
  reportLines.push(`- parseGmePun OK: \`${parserOk}\``);
  if (!parserOk) {
    reportLines.push("```");
    reportLines.push(parserMsg);
    reportLines.push("```");
  }
  reportLines.push("");

  if (parsed) {
    const stats = (pts: { hour: number; value: number }[]) => {
      if (pts.length === 0) return { n: 0, min: NaN, max: NaN, median: NaN };
      const v = pts.map((p) => p.value).sort((a, b) => a - b);
      const median =
        v.length % 2 === 0 ? (v[v.length / 2 - 1] + v[v.length / 2]) / 2 : v[(v.length - 1) / 2];
      return { n: pts.length, min: v[0], max: v[v.length - 1], median };
    };
    reportLines.push(`### Statistiche valori (€/MWh)`);
    reportLines.push("");
    reportLines.push(`| serie | n | min | median | max |`);
    reportLines.push(`|---|---|---|---|---|`);
    const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "—");
    const pun = stats(parsed.pun_national);
    reportLines.push(`| PUN | ${pun.n} | ${fmt(pun.min)} | ${fmt(pun.median)} | ${fmt(pun.max)} |`);
    for (const z of PHYSICAL_ZONES) {
      const s = stats(parsed.zonal[z]);
      reportLines.push(`| ${z} | ${s.n} | ${fmt(s.min)} | ${fmt(s.median)} | ${fmt(s.max)} |`);
    }
    reportLines.push("");
  }

  // 5) Verdetto + scrittura report
  const allZonesOk =
    parserOk &&
    parsed !== null &&
    parsed.pun_national.length === 24 &&
    PHYSICAL_ZONES.every((z) => parsed!.zonal[z].length === 24);
  reportLines.push(`## 4. Verdetto`);
  reportLines.push("");
  reportLines.push(
    allZonesOk
      ? `- ESITO: GO. Endpoint pubblico funzionante senza autenticazione utente. Servono solo cookie ASP.NET + token DNN scrapati dalla pagina contenitore.`
      : `- ESITO: ATTENZIONE. Dati incompleti — vedi tabella sopra. Possibile che l'asta del giorno non sia ancora chiusa, o che la struttura backend sia cambiata.`,
  );
  reportLines.push("");
  reportLines.push(`## Note operative`);
  reportLines.push("");
  reportLines.push(
    `- Il modulo Angular client-side mostra un disclaimer ("CONTINUA SU MERCATOELETTRICO.ORG") con cookie \`GmePolicy\`. Il backend NON lo richiede — testato omettendo il cookie e ricevendo HTTP 200 lo stesso. Resta una constraint legale (Condizioni d'uso del sito) ma non tecnica.`,
  );
  reportLines.push(
    `- Il PUN dal 1° gennaio 2025 è il "PUN Index GME" (media ponderata sui volumi), non più la media aritmetica zonale. L'API lo restituisce con \`Zona=PUN\`.`,
  );
  reportLines.push(
    `- Granularità disponibili: \`qh\` (15min), \`hh\` (30min), \`h\` (orario), \`d\`, \`m\`, \`y\`. Per Energy Index uso \`h\`.`,
  );
  reportLines.push(
    `- Vecchie URL del piano (DatiSintesi.aspx, EsitiXML.aspx) sono **404** — il sito è stato rifatto in DNN + Angular. Aggiornare il plan-of-record.`,
  );

  await saveSample(reportFile, reportLines.join("\n"));

  if (!allZonesOk) {
    console.error("[gme-pun] dati incompleti, vedi report:", reportFile);
    process.exit(1);
  }
  console.log("[gme-pun] OK — sample:", rawJsonPath, "report:", reportFile);
}

function yesterdayIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

// Esegui solo quando invocato come script (non quando importato dal test).
const invokedAsScript =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("gme-pun.ts");
if (invokedAsScript) {
  main().catch((err) => {
    console.error("[gme-pun] FATAL", err);
    process.exit(1);
  });
}
