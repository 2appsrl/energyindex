# Fase 0 — Spike Fonti Dati Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verificare in modo concreto che le 3 fonti dati (GME, ENTSO-E, ARERA Portale Offerte) siano accessibili pubblicamente, capire il loro formato esatto, e produrre un "spike report" go/plan-B che informi la Fase 1 (MVP Italia). NON costruiamo ancora il sito — questa fase serve solo a togliere il rischio principale del progetto.

**Architecture:** Cartella `spikes/` con uno script TypeScript standalone per ogni fonte. Ogni script scarica una giornata di dati reali, salva un campione raw in `spikes/samples/` (utile dopo come fixture per i test della Fase 1), e produce un mini-report in `spikes/reports/`. Niente DB, niente Supabase, niente Next.js — solo Node + tsx + fetch + parser. Al termine, un documento finale `docs/plans/2026-05-01-spike-report.md` raccoglie le scoperte e decide go/plan-B per ciascuna fonte.

**Tech Stack:** Node.js 20+, TypeScript, tsx (esecuzione TS senza build), fetch nativo, fast-xml-parser per gli XML (GME e ENTSO-E producono XML), zod per validare le risposte parse. Vitest per i parser test su sample salvati.

**Riferimento al design:** vedi `docs/plans/2026-05-01-energy-index-design.md` sezione 7 (Pipeline dati) e sezione 10 (Roadmap, Fase 0).

**Riferimento allo skill testing:** @superpowers:test-driven-development. I parser delle risposte API hanno test su sample reali salvati. Gli script di download invece sono spike investigativi — non servono test per il fetch in sé, basta che la chiamata reale ritorni dati validi.

---

## Pre-requisiti (manuali, una tantum)

Prima di iniziare i task, l'utente deve eseguire manualmente:

**M1. Registrazione ENTSO-E Transparency Platform**
- Andare su https://transparency.entsoe.eu/
- Cliccare "Login" → "Register"
- Compilare il form (servono email aziendale, motivo d'uso → "research/non-commercial energy market analysis")
- Confermare email
- Una volta dentro, "My Account Settings" → "Web Api Security Token" → richiedere il token (può richiedere fino a 3 giorni lavorativi di approvazione manuale ENTSO-E)
- Il token va condiviso con Claude tramite variabile d'ambiente `ENTSOE_API_TOKEN` (NON committato).

**Senza questo token, il Task 3 non può partire.** Se il token tarda, Task 1, 2, 4 si fanno comunque in parallelo.

**M2. Conferma versione Node**
- Verificare `node --version` ≥ 20.0.0. Se inferiore, aggiornare via `nvm` o equivalente.

---

## Task 0: Project skeleton per spike

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `spikes/README.md`
- Create: `spikes/samples/.gitkeep`
- Create: `spikes/reports/.gitkeep`

**Step 1: Inizializzare package.json**

Run: `npm init -y` nella root di progetto.

**Step 2: Aggiungere dipendenze necessarie**

Run:
```bash
npm install --save-dev typescript@^5.3.0 tsx@^4.7.0 @types/node@^20.0.0 vitest@^1.2.0
npm install fast-xml-parser@^4.3.0 zod@^3.22.0 dotenv@^16.4.0
```

Expected: `package.json` contiene queste dipendenze, viene creata `node_modules/` e `package-lock.json`.

**Step 3: Configurare TypeScript**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "noEmit": true
  },
  "include": ["spikes/**/*", "tests/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 4: Configurare package.json scripts**

Modifica `package.json` aggiungendo:
```json
{
  "type": "module",
  "scripts": {
    "spike:gme-pun": "tsx spikes/gme-pun.ts",
    "spike:gme-psv": "tsx spikes/gme-psv.ts",
    "spike:entsoe": "tsx spikes/entsoe-dayahead.ts",
    "spike:arera": "tsx spikes/arera-offers.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 5: Configurare .gitignore**

Create `.gitignore`:
```
node_modules/
.env
.env.local
*.log
.DS_Store

# Spike samples policy: salviamo SOLO sample validi e anonimizzati come fixtures per i test futuri.
# Sample raw freschi vengono ignorati per non gonfiare il repo.
spikes/samples/raw/
```

**Step 6: Creare .env.example**

Create `.env.example`:
```
# ENTSO-E Transparency Platform API Token
# Ottenere da https://transparency.entsoe.eu/ dopo registrazione
ENTSOE_API_TOKEN=your_token_here
```

**Step 7: Creare README spike**

Create `spikes/README.md` con il contenuto:
```markdown
# Spikes — Fase 0 fonti dati

Questa cartella contiene script standalone investigativi per verificare l'accessibilità delle 3 fonti dati pubbliche del progetto Energy Index.

NON è codice di produzione. Serve solo a:
1. Confermare che le fonti sono accessibili senza autenticazione (o con quale autenticazione).
2. Capire il formato esatto delle risposte.
3. Salvare campioni reali in `samples/` da usare come fixture nei test di Fase 1.
4. Produrre un report finale `../docs/plans/2026-05-01-spike-report.md` con decisione go/plan-B.

## Eseguire uno spike

```bash
cp .env.example .env  # solo la prima volta, popolare con token reale
npm run spike:gme-pun
npm run spike:gme-psv
npm run spike:entsoe   # richiede ENTSOE_API_TOKEN in .env
npm run spike:arera
```

## Output

- `samples/raw/` — risposte raw scaricate (gitignored, non committate)
- `samples/fixtures/` — sample anonimizzati committati come fixture test
- `reports/` — output testuale di ogni run con timestamp
```

**Step 8: Creare placeholder cartelle**

```bash
mkdir -p spikes/samples/raw spikes/samples/fixtures spikes/reports
touch spikes/samples/.gitkeep spikes/samples/fixtures/.gitkeep spikes/reports/.gitkeep
```

**Step 9: Verifica installazione**

Run: `npx tsx --version && npx vitest --version`
Expected: due numeri di versione, niente errori.

**Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .env.example spikes/
git commit -m "chore: scaffold spike project skeleton (Node + tsx + vitest)"
```

---

## Task 1: Spike GME PUN

**Goal:** scaricare gli esiti MGP del giorno corrente dal portale GME e parsare i 24 valori PUN orari + 24×6 valori zonali (Nord, Centro-Nord, Centro-Sud, Sud, Sicilia, Sardegna).

**Files:**
- Create: `spikes/gme-pun.ts`
- Create: `spikes/lib/save-sample.ts` (helper condiviso)
- Create: `tests/parsers/gme-pun.test.ts` (parser test)

**Step 1: Manual exploration prima dello script**

Run: ricerca manuale (browser) per identificare l'URL pubblico esatto dei file MGP. Il GME pubblica gli esiti in due forme:

- **Statistiche aggregate** (HTML/Excel): https://www.mercatoelettrico.org/it/Statistiche/ME/DatiSintesi.aspx
- **Esiti XML** giornalieri: https://www.mercatoelettrico.org/it/MenuBiblioteca/documenti/EsitiXML.aspx
- **GME Public Owner Area** (richiede registrazione): API XML strutturate

Aprire ognuno e annotare quale è scaricabile senza login.

Output atteso: 1-2 URL identificati che restituiscono dati senza autenticazione, con esempio scaricato manualmente in `spikes/samples/raw/gme-pun-manual-YYYYMMDD.xml`.

**⚠️ Se GME richiede registrazione obbligatoria per gli esiti XML**: registrarsi al GME Public Area (è gratuita ma serve attenderne l'approvazione). Documentare il vincolo nel report finale come potenziale plan-B.

**Step 2: Helper condiviso per salvare sample**

Create `spikes/lib/save-sample.ts`:
```typescript
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export async function saveSample(path: string, content: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  console.log(`[saved] ${path}`);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function reportPath(spikeName: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `spikes/reports/${spikeName}-${ts}.md`;
}
```

**Step 3: Scrivere lo spike GME PUN**

Create `spikes/gme-pun.ts`:
```typescript
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { saveSample, todayIsoDate, reportPath } from "./lib/save-sample.js";

// TODO: sostituire con l'URL reale identificato in Step 1
const GME_PUN_URL = "https://www.mercatoelettrico.org/it/MenuBiblioteca/documenti/EsitiXML.aspx?...";

async function main() {
  const date = todayIsoDate();
  console.log(`[spike-gme-pun] fetching MGP results for ${date}`);

  const res = await fetch(GME_PUN_URL, {
    headers: { "User-Agent": "EnergyIndex-Spike/0.1 (research)" },
  });
  if (!res.ok) {
    throw new Error(`GME fetch failed: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  await saveSample(`spikes/samples/raw/gme-pun-${date}.xml`, xml);

  // Parse
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  console.log("[spike-gme-pun] parsed structure top-level keys:",
    Object.keys(parsed));

  // TODO: una volta vista la struttura reale, scrivere lo zod schema
  // e estrarre PUN nazionale + 6 zone × 24 ore.
  // Per ora stampa solo il primo livello per esplorazione.

  const report = `# GME PUN spike — ${date}

- URL: ${GME_PUN_URL}
- HTTP status: ${res.status}
- Bytes: ${xml.length}
- Top-level XML keys: ${Object.keys(parsed).join(", ")}

## Next
- Definire schema zod basato su struttura osservata
- Estrarre 24 valori PUN nazionali e 24 × 6 valori zonali
`;
  await saveSample(reportPath("gme-pun"), report);
  console.log("[spike-gme-pun] done");
}

main().catch((err) => {
  console.error("[spike-gme-pun] FAILED:", err);
  process.exit(1);
});
```

**Step 4: Eseguire lo spike**

Run: `npm run spike:gme-pun`

Expected:
- File `spikes/samples/raw/gme-pun-YYYY-MM-DD.xml` creato (>1 KB).
- File `spikes/reports/gme-pun-*.md` creato con HTTP 200 e top-level keys.
- Console output con keys osservate.

Se HTTP 4xx/5xx: catturare l'errore, documentarlo nel report, valutare plan-B (registrazione GME Public Area).

**Step 5: Iterare il parser fino a estrarre PUN + zone**

Una volta visto il top-level XML, **modificare** `spikes/gme-pun.ts` aggiungendo lo schema zod che riflette la struttura reale e l'estrazione dei valori. Il pattern probabile (basato su documentazione GME nota):

```typescript
const PrezziSchema = z.object({
  NewDataSet: z.object({
    Prezzi: z.array(z.object({
      Data: z.string(),    // "20260501"
      Ora: z.string(),     // "1".."24"
      Mercato: z.string(), // "MGP"
      PUN: z.string(),     // "142.30" (decimale con punto)
      NORD: z.string().optional(),
      CNOR: z.string().optional(),
      CSUD: z.string().optional(),
      SUD: z.string().optional(),
      SICI: z.string().optional(),
      SARD: z.string().optional(),
    })),
  }),
});
```

Iterare: parse → log → adattare → riparse → finché non si vedono 24 righe con PUN numerico ragionevole (50-300 €/MWh tipici).

**Step 6: Salvare un sample anonimizzato come fixture**

Una volta che il parser funziona, copiare il sample raw in `spikes/samples/fixtures/gme-pun-fixture.xml` (questo verrà committato e usato dai test).

**Step 7: Scrivere il parser test**

Create `tests/parsers/gme-pun.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parseGmePun } from "../../spikes/gme-pun.js"; // estrarre la funzione di parsing

describe("parseGmePun", () => {
  it("parses 24 hourly PUN values from real GME sample", async () => {
    const xml = await readFile("spikes/samples/fixtures/gme-pun-fixture.xml", "utf-8");
    const result = parseGmePun(xml);

    expect(result.pun_national).toHaveLength(24);
    expect(result.pun_national[0]).toMatchObject({
      hour: expect.any(Number),
      value: expect.any(Number),
    });
    // sanity: prezzi in range realistico €/MWh
    result.pun_national.forEach((p) => {
      expect(p.value).toBeGreaterThan(-100); // prezzi negativi possibili ma rari
      expect(p.value).toBeLessThan(2000);
    });
  });

  it("parses 6 zonal series", async () => {
    const xml = await readFile("spikes/samples/fixtures/gme-pun-fixture.xml", "utf-8");
    const result = parseGmePun(xml);
    expect(Object.keys(result.zonal).sort()).toEqual(
      ["CNOR", "CSUD", "NORD", "SARD", "SICI", "SUD"]
    );
  });
});
```

**Step 8: Refactor: estrarre `parseGmePun` come funzione esportata**

Modificare `spikes/gme-pun.ts`: estrarre la logica di parsing in una funzione `export function parseGmePun(xml: string): { pun_national: ..., zonal: ... }`. Lo script `main()` la usa, e anche il test la importa.

**Step 9: Eseguire il test**

Run: `npm test -- gme-pun`
Expected: 2 test PASS.

**Step 10: Commit**

```bash
git add spikes/gme-pun.ts spikes/lib/save-sample.ts spikes/samples/fixtures/gme-pun-fixture.xml tests/parsers/gme-pun.test.ts
git commit -m "spike: GME PUN download and parser working with real sample"
```

---

## Task 2: Spike GME PSV

**Goal:** identico al Task 1 ma per il prezzo PSV/MGP-GAS giornaliero. Più semplice perché è 1 valore al giorno (non 24×7).

**Files:**
- Create: `spikes/gme-psv.ts`
- Create: `tests/parsers/gme-psv.test.ts`
- Create: `spikes/samples/fixtures/gme-psv-fixture.xml` (o JSON, dipende dal formato GME)

**Step 1: Manual exploration**

Identificare l'URL pubblico per i risultati MGP-GAS / PSV su https://www.mercatoelettrico.org/it/Statistiche/Gas/ — annotare formato (HTML scrape vs XML structured).

**Step 2: Scrivere `spikes/gme-psv.ts`** seguendo lo stesso pattern di Task 1: fetch → save raw → parse → log struttura → iterare schema.

**Step 3: Eseguire**: `npm run spike:gme-psv` — verificare HTTP 200 e dato numerico in range realistico (15-80 €/MWh tipici per PSV).

**Step 4: Estrarre parser come funzione `parseGmePsv` esportata.**

**Step 5: Salvare fixture in `spikes/samples/fixtures/gme-psv-fixture.{xml,json}`**

**Step 6: Scrivere test:**
```typescript
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parseGmePsv } from "../../spikes/gme-psv.js";

describe("parseGmePsv", () => {
  it("parses daily PSV value from real GME sample", async () => {
    const raw = await readFile("spikes/samples/fixtures/gme-psv-fixture.xml", "utf-8");
    const result = parseGmePsv(raw);
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.value).toBeGreaterThan(5);
    expect(result.value).toBeLessThan(200);
  });
});
```

**Step 7: Run test**: `npm test -- gme-psv` → PASS.

**Step 8: Commit**:
```bash
git add spikes/gme-psv.ts spikes/samples/fixtures/gme-psv-fixture.* tests/parsers/gme-psv.test.ts
git commit -m "spike: GME PSV download and parser working with real sample"
```

---

## Task 3: Spike ENTSO-E day-ahead

**Goal:** chiamare l'API REST di ENTSO-E Transparency Platform per ottenere day-ahead price di Italia, Germania, Francia per oggi. Validare che il token funzioni e l'XML sia parsabile.

**⚠️ PRE-REQUISITO**: utente ha completato registrazione e ha il token in `.env` come `ENTSOE_API_TOKEN`. Senza token questo task non parte.

**Files:**
- Create: `spikes/entsoe-dayahead.ts`
- Create: `spikes/lib/entsoe-domains.ts`
- Create: `tests/parsers/entsoe.test.ts`
- Create: `spikes/samples/fixtures/entsoe-de-fixture.xml`

**Step 1: Documenta i domain code**

Create `spikes/lib/entsoe-domains.ts`:
```typescript
// ENTSO-E EIC bidding zone codes — fonte: https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html
export const ENTSOE_DOMAINS = {
  IT_NORTH: "10Y1001A1001A73I",
  IT_CNORTH: "10Y1001A1001A70O",
  IT_CSOUTH: "10Y1001A1001A71M",
  IT_SOUTH: "10Y1001A1001A788",
  IT_SICILY: "10Y1001A1001A75E",
  IT_SARDINIA: "10Y1001A1001A74G",
  DE_LU: "10Y1001A1001A82H",  // Germany-Luxembourg bidding zone
  FR: "10YFR-RTE------C",
  ES: "10YES-REE------0",
  AT: "10YAT-APG------L",
  NL: "10YNL----------L",
  BE: "10YBE----------2",
  CH: "10YCH-SWISSGRIDZ",
} as const;

export type EntsoeDomain = keyof typeof ENTSOE_DOMAINS;
```

**Step 2: Caricare .env**

Verifica che `.env` contenga `ENTSOE_API_TOKEN=...` (NON committato). Se manca, **fermarsi qui** e richiedere all'utente.

**Step 3: Scrivere lo spike**

Create `spikes/entsoe-dayahead.ts`:
```typescript
import "dotenv/config";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { ENTSOE_DOMAINS } from "./lib/entsoe-domains.js";
import { saveSample, todayIsoDate, reportPath } from "./lib/save-sample.js";

const TOKEN = process.env.ENTSOE_API_TOKEN;
if (!TOKEN) {
  console.error("Missing ENTSOE_API_TOKEN in .env");
  process.exit(1);
}

// API doc: https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html
// documentType A44 = Day-ahead prices
function buildUrl(domain: string, periodStart: string, periodEnd: string): string {
  const params = new URLSearchParams({
    securityToken: TOKEN!,
    documentType: "A44",
    in_Domain: domain,
    out_Domain: domain,
    periodStart,
    periodEnd,
  });
  return `https://web-api.tp.entsoe.eu/api?${params.toString()}`;
}

function yyyymmddhhmm(d: Date): string {
  const y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, "0");
  const D = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}${M}${D}${h}${m}`;
}

async function main() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const periodStart = yyyymmddhhmm(today);
  const periodEnd = yyyymmddhhmm(tomorrow);

  const targets: Array<[string, string]> = [
    ["DE_LU", ENTSOE_DOMAINS.DE_LU],
    ["FR", ENTSOE_DOMAINS.FR],
    ["IT_NORTH", ENTSOE_DOMAINS.IT_NORTH],
  ];

  const results: Array<{ name: string; status: number; bytes: number; sample: string }> = [];

  for (const [name, domain] of targets) {
    const url = buildUrl(domain, periodStart, periodEnd);
    console.log(`[entsoe] fetching ${name} (${domain})`);
    const res = await fetch(url);
    const xml = await res.text();
    const samplePath = `spikes/samples/raw/entsoe-${name}-${todayIsoDate()}.xml`;
    await saveSample(samplePath, xml);
    results.push({ name, status: res.status, bytes: xml.length, sample: samplePath });

    if (res.ok) {
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(xml);
      console.log(`[entsoe] ${name} top-level keys:`, Object.keys(parsed));
    } else {
      console.warn(`[entsoe] ${name} HTTP ${res.status}: ${xml.slice(0, 200)}`);
    }
  }

  const report = `# ENTSO-E day-ahead spike — ${todayIsoDate()}

${results.map((r) => `- ${r.name}: HTTP ${r.status}, ${r.bytes} bytes → ${r.sample}`).join("\n")}
`;
  await saveSample(reportPath("entsoe"), report);
  console.log("[entsoe] done");
}

main().catch((err) => {
  console.error("[entsoe] FAILED:", err);
  process.exit(1);
});
```

**Step 4: Eseguire**

Run: `npm run spike:entsoe`
Expected: 3 file XML in `samples/raw/`, ognuno >1 KB, tutti HTTP 200.

Se HTTP 401: token non valido → controllare `.env`.
Se HTTP 429: rate limit → aggiungere `await new Promise(r => setTimeout(r, 1000))` tra le chiamate.

**Step 5: Iterare schema basato su struttura XML osservata**

ENTSO-E ritorna `Publication_MarketDocument > TimeSeries > Period > Point[]` con `position` (1..24) e `price.amount`. Definire zod schema e funzione `parseEntsoeDayAhead(xml): { points: Array<{position, price}> }`.

**Step 6: Salvare un fixture per i test**

Copiare `samples/raw/entsoe-DE_LU-YYYY-MM-DD.xml` in `samples/fixtures/entsoe-de-fixture.xml`.

**Step 7: Scrivere test**

Create `tests/parsers/entsoe.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { parseEntsoeDayAhead } from "../../spikes/entsoe-dayahead.js";

describe("parseEntsoeDayAhead", () => {
  it("parses 24 hourly day-ahead prices from real ENTSO-E sample", async () => {
    const xml = await readFile("spikes/samples/fixtures/entsoe-de-fixture.xml", "utf-8");
    const result = parseEntsoeDayAhead(xml);
    expect(result.points).toHaveLength(24);
    result.points.forEach((p) => {
      expect(p.position).toBeGreaterThanOrEqual(1);
      expect(p.position).toBeLessThanOrEqual(24);
      expect(p.price).toBeGreaterThan(-200);
      expect(p.price).toBeLessThan(2000);
    });
  });
});
```

**Step 8: Run test**

Run: `npm test -- entsoe` → PASS.

**Step 9: Commit**

```bash
git add spikes/entsoe-dayahead.ts spikes/lib/entsoe-domains.ts spikes/samples/fixtures/entsoe-de-fixture.xml tests/parsers/entsoe.test.ts
git commit -m "spike: ENTSO-E day-ahead API working for DE/FR/IT-North"
```

---

## Task 4: Spike ARERA Portale Offerte

**Goal:** verificare se le offerte mercato libero del Portale Offerte ARERA sono accessibili in bulk via dataset pubblico, scaricarne un campione, e capire la struttura. Questa è la fonte **più rischiosa** del progetto — se non c'è bulk API, dobbiamo scegliere tra (a) scraping HTML legale ma fragile o (b) plan-B alternativo.

**Files:**
- Create: `spikes/arera-offers.ts`
- Create: `spikes/notes/arera-investigation.md` (note investigative)

**Step 1: Investigation manuale**

Aprire https://www.ilportaleofferte.it/portaleOfferte/ e cercare:

1. Sezione "**Open Data**" o "**Dataset**" o "**Per gli sviluppatori**" — spesso ARERA pubblica i dataset XML/JSON delle offerte registrate.
2. Pagina `https://www.ilportaleofferte.it/portaleOfferte/static/contenuti/datiOfferte.html` (se esiste).
3. Statistiche / Trasparenza: `https://www.arera.it/it/comunicazioni/trasparenza.htm`
4. Contatti tecnici per accesso dati: a volte serve PEC formale.

**Documentare in `spikes/notes/arera-investigation.md`** ogni opzione trovata con URL, formato, requisiti di accesso.

**Step 2: Decision tree dopo investigation**

In base a cosa si trova in Step 1:

- **Caso A**: dataset bulk pubblico (XML/JSON) scaricabile direttamente → procedere con script `arera-offers.ts` come negli altri task.
- **Caso B**: solo ricerca singola via form sul sito (no bulk) → script di scraping multipagina HTML con `cheerio` o `playwright`. Più fragile, da segnalare nel report finale.
- **Caso C**: accesso solo via PEC/account autenticato → bloccato per Energy Index pubblico. Decidere plan-B (es. usare solo gli **indici di prezzo medio** che ARERA pubblica trimestralmente, accettando aggiornamento meno frequente).

**Step 3 (Caso A): script di download**

Create `spikes/arera-offers.ts`:
```typescript
import { saveSample, todayIsoDate, reportPath } from "./lib/save-sample.js";

const ARERA_OFFERS_URL = ""; // riempire con l'URL trovato in Step 1

async function main() {
  if (!ARERA_OFFERS_URL) {
    console.error("ARERA_OFFERS_URL non ancora identificato — completa investigation in spikes/notes/arera-investigation.md");
    process.exit(1);
  }

  console.log(`[arera] fetching ${ARERA_OFFERS_URL}`);
  const res = await fetch(ARERA_OFFERS_URL, {
    headers: { "User-Agent": "EnergyIndex-Spike/0.1 (research)" },
  });

  const body = await res.text();
  const ext = ARERA_OFFERS_URL.endsWith(".json") ? "json" :
              ARERA_OFFERS_URL.endsWith(".xml") ? "xml" : "txt";
  await saveSample(`spikes/samples/raw/arera-offers-${todayIsoDate()}.${ext}`, body);

  const report = `# ARERA Portale Offerte spike — ${todayIsoDate()}
- URL: ${ARERA_OFFERS_URL}
- HTTP: ${res.status}
- Bytes: ${body.length}
- Content-Type: ${res.headers.get("content-type")}
`;
  await saveSample(reportPath("arera"), report);
  console.log("[arera] done");
}

main().catch((err) => {
  console.error("[arera] FAILED:", err);
  process.exit(1);
});
```

Run: `npm run spike:arera`. Expected: HTTP 200, file >1 KB.

Una volta visto il formato, scrivere parser + test analoghi a Task 1-3 con sample fixture, **conteggio offerte** (>50?), e estrazione campi chiave (`offer_code`, `supplier`, `commodity`, `price_type`, `price_value`).

**Step 4 (Caso B o C): documenta plan-B nel report**

Se Caso A non è possibile, NON scrivere lo scraping in Fase 0. Documenta solo nel report finale (Task 5):
- Cosa è stato tentato
- Cosa serve realmente per accedere
- Stima dello sforzo per implementare scraping HTML in Fase 1
- Plan-B: usare solo dati aggregati ARERA pubblicati trimestralmente (link da identificare)

**Step 5: Commit**

```bash
git add spikes/arera-offers.ts spikes/notes/arera-investigation.md
# se Caso A:
git add spikes/samples/fixtures/arera-offers-fixture.* tests/parsers/arera.test.ts
git commit -m "spike: ARERA Portale Offerte access investigation"
```

---

## Task 5: Spike report finale & decisione go/plan-B

**Goal:** consolidare le scoperte di Task 1-4 in un documento di decisione che chiude la Fase 0 e abilita la Fase 1.

**Files:**
- Create: `docs/plans/2026-05-01-spike-report.md`

**Step 1: Compilare il report**

Create `docs/plans/2026-05-01-spike-report.md` con questa struttura:

```markdown
# Spike Report — Fonti Dati Energy Index (Fase 0)

**Data**: 2026-05-XX (data effettiva di completamento)
**Esito**: [GO / PLAN-B PARZIALE / BLOCCO]

## Sommario decisionale

| Fonte | Esito | Plan A | Plan B se necessario |
|---|---|---|---|
| GME PUN | ✅/⚠️/❌ | URL: ... | ... |
| GME PSV | ✅/⚠️/❌ | URL: ... | ... |
| ENTSO-E | ✅/⚠️/❌ | API REST + token | ... |
| ARERA Offerte | ✅/⚠️/❌ | Dataset pubblico vs scraping vs aggregati trimestrali | ... |

## GME PUN — dettagli

- URL confermato: ...
- Formato: XML / Excel / HTML
- Frequenza pubblicazione: ~12:30 ora italiana, dati per giorno successivo
- Autenticazione: nessuna / Public Owner Area
- Schema chiavi principali osservate: ...
- Numero righe sample: ... (atteso 24 × 7 zone = 168)
- Robustezza prevista: alta/media/bassa — perché
- Sample fixture: `spikes/samples/fixtures/gme-pun-fixture.xml`

## GME PSV — dettagli
[stesso schema]

## ENTSO-E day-ahead — dettagli
[stesso schema, nota su tempi di approvazione token]

## ARERA Portale Offerte — dettagli
[stesso schema, con esplicito plan-B se Caso B/C]

## Decisioni per Fase 1

Sulla base degli spike, in Fase 1 (MVP Italia) implementeremo:

1. **etl-gme-pun**: ... (basato su URL X, parser confermato in test)
2. **etl-gme-psv**: ...
3. **etl-entsoe-dayahead**: ...
4. **etl-arera-offers**: ... oppure: NON implementiamo, sostituiamo con [aggregati trimestrali ARERA / scraping in Fase 2 / altro].

## Costi nascosti emersi

[es. "GME bundle PUN richiede registrazione → 2-3 giorni di attesa", "ENTSO-E rate limit a 400 req/min", ecc.]

## Aggiornamenti necessari al design doc

[lista bullet di modifiche da apportare a `2026-05-01-energy-index-design.md` se le scoperte invalidano qualche assunzione]
```

**Step 2: Aggiornare il design doc se serve**

Se il report rivela cose che invalidano il design originale (es. "ARERA non è accessibile, dobbiamo cambiare la fonte degli aggregati"), modificare `docs/plans/2026-05-01-energy-index-design.md` di conseguenza.

**Step 3: Commit finale Fase 0**

```bash
git add docs/plans/2026-05-01-spike-report.md
git commit -m "docs: spike report Fase 0 — go/plan-B decision per ogni fonte dati"
```

**Step 4: Tag della release fase 0**

```bash
git tag fase-0-complete -m "Spike fonti dati completato"
```

---

## Definition of Done — Fase 0

La Fase 0 è completa SOLO quando TUTTI questi punti sono veri:

- [ ] `npm install` funziona da clone pulito senza errori.
- [ ] `npm run spike:gme-pun` esce con 0 e produce sample valido.
- [ ] `npm run spike:gme-psv` esce con 0 e produce sample valido.
- [ ] `npm run spike:entsoe` esce con 0 e produce sample valido per almeno 3 paesi (DE, FR, IT-NORTH).
- [ ] `npm run spike:arera` esce con 0 OPPURE è documentato esplicitamente nel report perché non è possibile e quale plan-B adottiamo.
- [ ] `npm test` mostra ≥3 test PASS (uno per parser GME PUN, uno per GME PSV, uno per ENTSO-E; ARERA opzionale a seconda dell'esito).
- [ ] File `docs/plans/2026-05-01-spike-report.md` esiste e contiene una decisione esplicita per ognuna delle 4 fonti.
- [ ] Tag git `fase-0-complete` creato.
- [ ] L'utente ha letto il report e dato approvazione esplicita per passare alla Fase 1.

## Cosa NON si fa in Fase 0 (esplicito)

- Niente Next.js scaffold.
- Niente Supabase setup.
- Niente componenti UI.
- Niente cron / scheduler (gli script si lanciano a mano).
- Niente deploy.
- Niente i18n.
- Niente DB persistente — i sample vivono come file in `spikes/samples/`.

Questi arrivano tutti in Fase 1.
