/**
 * Spike GME PSV — Fase 0
 *
 * Verifica accessibilità pubblica del prezzo di riferimento PSV
 * (Punto di Scambio Virtuale = hub gas all'ingrosso italiano)
 * pubblicato da GME come esito del MGP-GAS.
 *
 * Reality check (investigazione 2026-05-01):
 *  - La pagina contenitore è https://www.mercatoelettrico.org/it-it/Home/Esiti/Gas/MGP/Esiti
 *    (redirige a .../Gas/MGP-GAS/Esiti/NegoziazioneContinua/MGP/Esiti, 200 OK).
 *  - Il modulo Angular si chiama `GmeEsitiMGAS` (NON `GmeEsitiPrezziGAS`):
 *      routingWebAPI = "/DesktopModules/GmeEsitiMGAS/API/"
 *  - Endpoint (auth: stessi token DNN scrapati dalla pagina, NESSUN account utente):
 *      GET /DesktopModules/GmeEsitiMGAS/API/item/GetGasEsitiMGAS
 *           ?DataSessione=YYYYMMDD&Mercato=MGP
 *  - DataSessione=0 -> ultima sessione disponibile.
 *  - Risposta: array di righe per la sessione di trading richiesta.
 *    Ogni riga descrive UN prodotto:
 *      { data: 20260430, prodotto: "MGP-2026-05-01",
 *        firstPrice, lastPrice, prezzoMinimo, prezzoMassimo,
 *        prezzoRiferimento, prezzoControllo,
 *        volumiMW, volumiMWh, ... }
 *    `data` = data della sessione di trading (YYYYMMDD).
 *    `prodotto` = "MGP-YYYY-MM-DD" (consegna giornaliera), "WD-YYYY-WW", "WE-YYYY-WW".
 *
 * Definizione canonica del "prezzo PSV daily" usata in questo spike:
 *  per la sessione di trading T, il prezzo PSV per data di consegna T+1
 *  è la riga con prodotto = `MGP-(T+1)`, campo `prezzoRiferimento`.
 *  (E' l'analogo gas del PUN day-ahead: media ponderata sui volumi negoziati
 *  in continua per la consegna del giorno successivo.)
 *
 * NOTA: Da 15-ott-2025 GME ha attivato un canale API ufficiale separato
 *  (https://api.mercatoelettrico.org/) che richiede registrazione + credenziali
 *  e supporta MGP-GAS / PBZ-PSV. La licenza standard di quel canale è però
 *  "uso informativo privato", non compatibile con la pubblicazione su un sito
 *  pubblico come Energy Index. Per la produzione del progetto resta quindi
 *  Plan A questo canale DNN pubblico (helper validato in Fase 0); l'API
 *  ufficiale è Plan B SOLO se ottenuta una licenza commerciale separata da GME.
 *  Vedi `docs/plans/2026-05-01-spike-report.md` sez. 1 e 3.2 per il razionale.
 */
import { saveSample, todayIsoDate, reportPath } from "./lib/save-sample.js";
import {
  GME_BASE,
  GME_USER_AGENT,
  bootstrapGmeDnnSession,
  gmeApiGet,
  type GmeDnnSession,
} from "../supabase/functions/_shared/gme-dnn.js";
import { z } from "zod";

const BASE = GME_BASE;
const PAGE_PATH = "/it-it/Home/Esiti/Gas/MGP/Esiti";
const PAGE_URL = BASE + PAGE_PATH;
const API_PATH = "/DesktopModules/GmeEsitiMGAS/API/item/GetGasEsitiMGAS";

// ---------------------------------------------------------------------------
// Schemas (zod)
// ---------------------------------------------------------------------------

/**
 * Una riga raw del backend MGP-GAS. Tutti i campi numerici di prezzo possono
 * essere null su prodotti che non hanno avuto scambi nella sessione richiesta
 * (es. WD-YYYY-WW nei giorni feriali, MGP-(T+2) prima che la sessione si apra).
 */
const GmeMgasRowSchema = z.object({
  data: z.number().int(), // sessione di trading YYYYMMDD
  prodotto: z.string(), // "MGP-YYYY-MM-DD" | "WD-YYYY-WW" | "WE-YYYY-WW"
  firstPrice: z.number().nullable(),
  lastPrice: z.number().nullable(),
  prezzoMinimo: z.number().nullable(),
  prezzoMassimo: z.number().nullable(),
  prezzoRiferimento: z.number().nullable(),
  prezzoControllo: z.number().nullable(),
  prezzoAcquisto: z.number().nullable(),
  prezzoVendita: z.number().nullable(),
  volumiMW: z.number().nullable(),
  volumiMWh: z.number().nullable(),
  volumiOTCMW: z.number().nullable(),
  volumiOTCMWh: z.number().nullable(),
  posizioniAperte: z.number().nullable(),
});
type GmeMgasRow = z.infer<typeof GmeMgasRowSchema>;

/** Forma del file combinato che salviamo come fixture. */
const CombinedSampleSchema = z.object({
  source: z.literal("gme-mgp-gas-psv"),
  url_base: z.string(),
  fetched_at: z.string(),
  sessions: z.array(
    z.object({
      session_date: z.string(), // YYYY-MM-DD (giorno di trading)
      http_status: z.number().int(),
      rows: z.array(GmeMgasRowSchema),
    }),
  ),
});
type CombinedSample = z.infer<typeof CombinedSampleSchema>;

/** Output del parser: 1 punto per ciascun giorno di consegna. */
const DailyPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // data di consegna ISO
  value: z.number(), // €/MWh
});
const ParseResultSchema = z.object({
  points: z.array(DailyPointSchema),
});
export type ParseResult = z.infer<typeof ParseResultSchema>;

// ---------------------------------------------------------------------------
// Pure parser (testabile su fixture)
// ---------------------------------------------------------------------------

/** Estrae la data di consegna ISO da un nome prodotto MGP-YYYY-MM-DD. */
function deliveryDateFromProdotto(prodotto: string): string | null {
  const m = prodotto.match(/^MGP-(\d{4}-\d{2}-\d{2})$/);
  return m ? m[1] : null;
}

/**
 * Parsa il sample combinato JSON.
 *
 * Per ciascuna sessione di trading T raccoglie il prezzoRiferimento del
 * prodotto MGP-(T+1) — il prezzo day-ahead per la consegna del giorno dopo.
 * Righe con prezzoRiferimento null o prodotti non-MGP (WD/WE) vengono ignorate.
 *
 * Risultato: array `points` ordinato per data crescente, deduplicato per data.
 */
export function parseGmePsv(rawContent: string): ParseResult {
  const json = JSON.parse(rawContent) as unknown;
  const sample = CombinedSampleSchema.parse(json);

  // Dedup: in caso un giorno di consegna comparisse in più sessioni
  // (es. fix-up post-asta), tieni la sessione più recente.
  const byDeliveryDate = new Map<string, { value: number; sessionDate: string }>();

  for (const session of sample.sessions) {
    // Calcola la data di consegna T+1 della sessione T.
    const expectedNextDay = addDaysIso(session.session_date, 1);

    for (const row of session.rows) {
      const delivery = deliveryDateFromProdotto(row.prodotto);
      if (delivery !== expectedNextDay) continue;
      if (row.prezzoRiferimento === null) continue;

      const existing = byDeliveryDate.get(delivery);
      if (!existing || existing.sessionDate < session.session_date) {
        byDeliveryDate.set(delivery, {
          value: row.prezzoRiferimento,
          sessionDate: session.session_date,
        });
      }
    }
  }

  const points = Array.from(byDeliveryDate.entries())
    .map(([date, v]) => ({ date, value: v.value }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return ParseResultSchema.parse({ points });
}

// ---------------------------------------------------------------------------
// HTTP / date helpers (solo per main())
// ---------------------------------------------------------------------------

function isoToCompact(iso: string): string {
  return iso.replace(/-/g, "");
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Permetti override per fixture deterministica.
  // Esempio: SPIKE_DATE_OVERRIDE=2026-04-30 npm run spike:gme-psv
  const override = process.env.SPIKE_DATE_OVERRIDE;
  const todayIso = override ?? todayIsoDate();
  const reportFile = reportPath("gme-psv");

  const reportLines: string[] = [];
  reportLines.push(`# Spike GME PSV (MGP-GAS) — ${todayIso}`);
  reportLines.push("");
  reportLines.push(`- User-Agent: \`${GME_USER_AGENT}\``);
  reportLines.push(`- Pagina contenitore: \`${PAGE_URL}\``);
  reportLines.push(`- Endpoint dati: \`${BASE}${API_PATH}\``);
  reportLines.push("");

  // 1) Bootstrap DNN session (helper condiviso con lo spike PUN).
  let session: GmeDnnSession;
  try {
    session = await bootstrapGmeDnnSession(PAGE_URL);
    reportLines.push(`## 1. Pagina contenitore`);
    reportLines.push("");
    reportLines.push(`- HTTP status: \`${session.pageStatus}\``);
    reportLines.push(`- Bytes HTML: \`${session.pageBytes}\``);
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
    console.error("[gme-psv] bootstrap fallito:", err);
    process.exit(1);
  }

  // 2) Per le ultime 7 sessioni (da 7 giorni fa a oggi) chiamiamo l'endpoint
  //    una volta a sessione (l'API è single-day, non range).
  reportLines.push(`## 2. Chiamate API`);
  reportLines.push("");
  reportLines.push(`| sessione | http | bytes | n. righe | MGP-(T+1) prezzoRif |`);
  reportLines.push(`|---|---|---|---|---|`);

  const sessions: CombinedSample["sessions"] = [];
  // 7 giorni indietro inclusivo del giorno odierno.
  const sessionIsoDates: string[] = [];
  for (let n = 6; n >= 0; n--) sessionIsoDates.push(addDaysIso(todayIso, -n));

  for (const sessIso of sessionIsoDates) {
    const compact = isoToCompact(sessIso);
    const { status, body } = await gmeApiGet(session, API_PATH, {
      DataSessione: compact,
      Mercato: "MGP",
    });

    let rows: GmeMgasRow[] = [];
    if (status === 200) {
      try {
        const arr = JSON.parse(body);
        if (Array.isArray(arr)) rows = arr.map((r) => GmeMgasRowSchema.parse(r));
      } catch {
        // ignored — riportato come 0 righe nella tabella.
      }
    }

    sessions.push({ session_date: sessIso, http_status: status, rows });

    const nextIso = addDaysIso(sessIso, 1);
    const nextProdotto = `MGP-${nextIso}`;
    const refRow = rows.find((r) => r.prodotto === nextProdotto);
    const refStr =
      refRow && refRow.prezzoRiferimento !== null
        ? refRow.prezzoRiferimento.toFixed(4)
        : "—";
    reportLines.push(
      `| ${sessIso} | ${status} | ${body.length} | ${rows.length} | ${refStr} |`,
    );

    // Salviamo anche il raw per ogni sessione (in spikes/samples/raw/, gitignored).
    if (status === 200 && body.length > 0) {
      await saveSample(`spikes/samples/raw/gme-psv-session-${sessIso}.json`, body);
    }
  }
  reportLines.push("");

  // 3) Salva sample combinato.
  const combined: CombinedSample = {
    source: "gme-mgp-gas-psv",
    url_base: BASE,
    fetched_at: new Date().toISOString(),
    sessions,
  };
  const combinedPath = `spikes/samples/raw/gme-psv-combined-${todayIso}.json`;
  await saveSample(combinedPath, JSON.stringify(combined, null, 2));

  // 4) Validazione tramite parser puro.
  reportLines.push(`## 3. Parser + validazione`);
  reportLines.push("");
  let parserOk = false;
  let parserMsg = "";
  let parsed: ParseResult | null = null;
  try {
    parsed = parseGmePsv(JSON.stringify(combined));
    parserOk = true;
  } catch (err) {
    parserMsg = String(err);
  }
  reportLines.push(`- parseGmePsv OK: \`${parserOk}\``);
  if (!parserOk) {
    reportLines.push("```");
    reportLines.push(parserMsg);
    reportLines.push("```");
  }
  reportLines.push("");

  if (parsed) {
    reportLines.push(`### Punti PSV estratti (1 valore per data di consegna)`);
    reportLines.push("");
    reportLines.push(`| consegna | €/MWh |`);
    reportLines.push(`|---|---|`);
    for (const p of parsed.points) {
      reportLines.push(`| ${p.date} | ${p.value.toFixed(4)} |`);
    }
    reportLines.push("");
    if (parsed.points.length > 0) {
      const values = parsed.points.map((p) => p.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const median = (() => {
        const v = values.slice().sort((a, b) => a - b);
        return v.length % 2 === 0
          ? (v[v.length / 2 - 1] + v[v.length / 2]) / 2
          : v[(v.length - 1) / 2];
      })();
      reportLines.push(`- min: ${min.toFixed(4)} €/MWh`);
      reportLines.push(`- median: ${median.toFixed(4)} €/MWh`);
      reportLines.push(`- max: ${max.toFixed(4)} €/MWh`);
      reportLines.push("");
    }
  }

  // 5) Verdetto.
  const points = parsed?.points ?? [];
  const allInRealisticBand = points.every((p) => p.value > 5 && p.value < 200);
  const verdict = parserOk && points.length >= 1 && allInRealisticBand;

  reportLines.push(`## 4. Verdetto`);
  reportLines.push("");
  reportLines.push(
    verdict
      ? `- ESITO: GO. ${points.length} punti PSV daily estratti, tutti in 5–200 €/MWh, parser pulito, endpoint pubblico funziona con bootstrap DNN.`
      : `- ESITO: ATTENZIONE. parser_ok=${parserOk} n_points=${points.length} band_ok=${allInRealisticBand}. Vedi tabella sessioni sopra (alcuni giorni potrebbero non avere ancora esiti pubblicati).`,
  );
  reportLines.push("");

  reportLines.push(`## Note operative`);
  reportLines.push("");
  reportLines.push(
    `- Bootstrap DNN identico a quello del PUN — fattorizzato in \`spikes/lib/gme-dnn.ts\`. Cookie ASP.NET + RequestVerificationToken + TabId + ModuleId estratti dalla pagina contenitore, riusati come headers. Nessun account utente richiesto.`,
  );
  reportLines.push(
    `- Endpoint **single-day**: l'API accetta un solo \`DataSessione=YYYYMMDD\` per call. Per uno storico serve un fan-out (1 call per sessione). \`DataSessione=0\` ritorna l'ultima sessione disponibile.`,
  );
  reportLines.push(
    `- Le righe del payload sono *prodotti*, non giorni: ogni sessione T espone tipicamente \`MGP-(T+1)\` (next-day) con prezzo valorizzato + 1-2 prodotti forward (\`MGP-(T+2)\`, \`MGP-(T+3)\`) tipicamente con \`prezzoRiferimento=null\`. In più \`WD-YYYY-WW\` (Within-Day) e nei venerdì \`WE-YYYY-WW\` (weekend).`,
  );
  reportLines.push(
    `- Convenzione PSV daily adottata: \`prezzoRiferimento\` del prodotto \`MGP-(T+1)\` per la sessione T. E' la grandezza che corrisponde concettualmente al "PUN day-ahead" lato gas.`,
  );
  reportLines.push(
    `- **Nessun parametro Zona/Tipologia**: a differenza dell'endpoint elettrico, l'API gas espone solo \`DataSessione\` e \`Mercato\` (MGP/MI/MT). Il PSV è implicito (è l'unico hub italiano).`,
  );
  reportLines.push(
    `- **API ufficiale GME**: dal 15 ottobre 2025 esiste un canale API ufficiale separato a \`https://api.mercatoelettrico.org/\` con manuale tecnico in \`/Portals/0/Documents/en-US/20251015Manuale_tecnico_API_En.pdf\`. Supporta MGP-GAS e PBZ-PSV (oltre a tutti i mercati elettrici), richiede registrazione (form a \`https://api.mercatoelettrico.org/users/RegistrationForm/RegistrationRequest\`) e restituisce i dati come .zip con .json base64-encoded. Disponibilità storica solo dal 1 ottobre 2025 in poi. **Licenza standard "uso informativo privato": NON utilizzabile per pubblicazione su un sito pubblico come Energy Index** senza licenza commerciale separata negoziata con GME. Plan A in produzione resta quindi questo canale DNN; l'API ufficiale è Plan B condizionato alla licenza commerciale.`,
  );
  reportLines.push(
    `- Festivi: la sessione MGP-GAS gira anche di sabato/domenica (l'asta gas è 7/7 a differenza del PUN). Quindi non ci si aspettano "buchi" sui weekend nei punti estratti.`,
  );

  await saveSample(reportFile, reportLines.join("\n"));

  if (!verdict) {
    console.error("[gme-psv] verdetto NEGATIVO, vedi report:", reportFile);
    process.exit(1);
  }
  console.log(
    "[gme-psv] OK —",
    points.length,
    "punti PSV. sample:",
    combinedPath,
    "report:",
    reportFile,
  );
}

// Esegui solo quando invocato come script (non quando importato dal test).
const invokedAsScript =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("gme-psv.ts");
if (invokedAsScript) {
  main().catch((err) => {
    console.error("[gme-psv] FATAL", err);
    process.exit(1);
  });
}
