# PUN Timeframe Selector — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aggiungere selector preset (5Y/1Y/6M/3M/1M/1S/1G) al chart PUN con default 5Y, aggregazione DB-side via `date_trunc`, e backfill 5 anni dall'archivio GME.

**Architecture:** Server-side RSC legge `?tf=` da `searchParams`, esegue query Postgres con bucket dinamico (orario raw o `date_trunc + AVG`). Selector è una pill row con `<Link>` Next.js (no client state). Backfill è uno script one-shot locale che riusa il parser/fetcher GME esistenti.

**Tech Stack:** Next.js 16 RSC, Supabase Postgres, lightweight-charts, Vitest, TSX, GME DNN API.

**Design doc:** `docs/plans/2026-05-07-pun-timeframe-selector-design.md`

---

## Task 1 — FAQ Q4 update (warm-up, isolato)

**Files:**
- Modify: `content/it/faq/pun.md` (Q4)

**Step 1: Edit Q4 in markdown**

Sostituisci la sezione `## Posso passare a una tariffa basata sul PUN?` con:

```markdown
## Posso passare a una tariffa basata sul PUN?

Sì. Le offerte "variabili" indicizzate al PUN aggiungono uno spread fisso al prezzo PUN dell'ora. In alternativa puoi scegliere tariffe a "prezzo fisso", che bloccano il costo dell'energia per 12 o 24 mesi a prescindere dall'andamento del mercato.
```

**Step 2: Commit**

```bash
git add content/it/faq/pun.md
git commit -m "docs(faq-pun): rimuove riferimento a energiapro in Q4 e aggiunge prezzo fisso come alternativa"
```

---

## Task 2 — `lib/timeframes.ts` con test

**Files:**
- Create: `lib/timeframes.ts`
- Create: `tests/lib/timeframes.test.ts`

**Step 1: Write failing tests**

Crea `tests/lib/timeframes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveTimeframe, TIMEFRAMES, type Timeframe } from "@/lib/timeframes";

describe("resolveTimeframe", () => {
  it("returns 5Y default when input is undefined or invalid", () => {
    expect(resolveTimeframe(undefined).id).toBe("5Y");
    expect(resolveTimeframe("nope").id).toBe("5Y");
    expect(resolveTimeframe("").id).toBe("5Y");
  });

  it("accepts all 7 valid presets", () => {
    const ids: Timeframe["id"][] = ["5Y", "1Y", "6M", "3M", "1M", "1S", "1G"];
    for (const id of ids) {
      expect(resolveTimeframe(id).id).toBe(id);
    }
  });

  it("maps 5Y to monthly bucket, interval '5 years'", () => {
    const tf = resolveTimeframe("5Y");
    expect(tf.bucket).toBe("month");
    expect(tf.intervalSql).toBe("5 years");
  });

  it("maps 1Y/6M/3M/1M to daily bucket", () => {
    for (const id of ["1Y", "6M", "3M", "1M"] as const) {
      expect(resolveTimeframe(id).bucket).toBe("day");
    }
  });

  it("maps 1S/1G to raw (no bucket aggregation)", () => {
    expect(resolveTimeframe("1S").bucket).toBe("raw");
    expect(resolveTimeframe("1G").bucket).toBe("raw");
  });

  it("exposes TIMEFRAMES array in display order 5Y...1G", () => {
    expect(TIMEFRAMES.map((t) => t.id)).toEqual([
      "5Y", "1Y", "6M", "3M", "1M", "1S", "1G",
    ]);
  });
});
```

**Step 2: Run, verify FAIL**

```bash
npx vitest run tests/lib/timeframes.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/timeframes'`.

**Step 3: Implement minimal**

Crea `lib/timeframes.ts`:

```ts
export type TimeframeId = "5Y" | "1Y" | "6M" | "3M" | "1M" | "1S" | "1G";
export type BucketKind = "month" | "day" | "raw";

export interface Timeframe {
  id: TimeframeId;
  label: string;
  /** Postgres `INTERVAL` literal (e.g. "5 years", "30 days") */
  intervalSql: string;
  /** date_trunc unit, or "raw" to skip aggregation (return hourly observations) */
  bucket: BucketKind;
  /** Heading mostrato sopra al chart */
  chartTitle: string;
}

export const TIMEFRAMES: readonly Timeframe[] = [
  { id: "5Y", label: "5Y", intervalSql: "5 years",  bucket: "month", chartTitle: "Andamento ultimi 5 anni" },
  { id: "1Y", label: "1Y", intervalSql: "1 year",   bucket: "day",   chartTitle: "Andamento ultimi 12 mesi" },
  { id: "6M", label: "6M", intervalSql: "6 months", bucket: "day",   chartTitle: "Andamento ultimi 6 mesi" },
  { id: "3M", label: "3M", intervalSql: "3 months", bucket: "day",   chartTitle: "Andamento ultimi 3 mesi" },
  { id: "1M", label: "1M", intervalSql: "30 days",  bucket: "day",   chartTitle: "Andamento ultimi 30 giorni" },
  { id: "1S", label: "1S", intervalSql: "7 days",   bucket: "raw",   chartTitle: "Andamento ultime 168 ore" },
  { id: "1G", label: "1G", intervalSql: "1 day",    bucket: "raw",   chartTitle: "Andamento ultime 24 ore" },
] as const;

const ID_SET = new Set(TIMEFRAMES.map((t) => t.id));

export function resolveTimeframe(input: string | undefined): Timeframe {
  if (input && ID_SET.has(input as TimeframeId)) {
    return TIMEFRAMES.find((t) => t.id === input)!;
  }
  return TIMEFRAMES[0]; // 5Y default
}
```

**Step 4: Run, verify PASS**

```bash
npx vitest run tests/lib/timeframes.test.ts
```
Expected: 6 passed.

**Step 5: Commit**

```bash
git add lib/timeframes.ts tests/lib/timeframes.test.ts
git commit -m "feat(timeframes): mapping TF -> {interval, bucket} con test Vitest"
```

---

## Task 3 — Backfill script (one-shot, locale)

**Files:**
- Create: `scripts/backfill-gme-pun.ts`
- Modify: `package.json` (aggiunge script `backfill:gme-pun`)

**Step 1: Implementa lo script**

Crea `scripts/backfill-gme-pun.ts` riusando il pattern di `spikes/gme-pun.ts` e di `supabase/functions/etl-gme-pun/index.ts`:

```ts
/**
 * One-shot backfill PUN dall'archivio GME.
 *
 * Itera da START_DATE a ieri, fetcha PUN nazionale + 6 zone fisiche per ogni
 * giorno, parse via parseGmePun (single source of truth), upsert in
 * price_observations. Idempotente (UNIQUE asset_id+observed_at).
 *
 * Eseguibile localmente: `npm run backfill:gme-pun`
 * Richiede in .env.local: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  bootstrapGmeDnnSession,
  gmeApiGet,
  GME_BASE,
  type GmeDnnSession,
} from "../supabase/functions/_shared/gme-dnn.ts";
import {
  parseGmePun,
  GmeRowSchema,
  PHYSICAL_ZONES,
  type GmeRow,
} from "../supabase/functions/_shared/parsers/gme-pun.ts";

const PAGE_PATH = "/it-it/Home/Esiti/Elettricita/MGP/Esiti/PUN";
const PAGE_URL = GME_BASE + PAGE_PATH;
const API_PATH = "/DesktopModules/GmeEsitiPrezziME/API/item/GetMEPrezzi";
const ZONES = PHYSICAL_ZONES;
type Zone = (typeof ZONES)[number];

// 5 anni fino a ieri.
const START_DATE = "2021-05-07";
const SLEEP_MS = 150;
const PROGRESS_EVERY_DAYS = 30;

function compactDate(iso: string) { return iso.replace(/-/g, ""); }
function addDaysIso(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function todayIso() { return new Date().toISOString().slice(0, 10); }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function hourToIso(date: string, hour: number) {
  const h = String(hour - 1).padStart(2, "0");
  return `${date}T${h}:00:00+02:00`;
}

async function fetchSeries(
  session: GmeDnnSession,
  zona: "PUN" | Zone,
  dataCompact: string,
): Promise<GmeRow[]> {
  const tipologia = zona === "PUN" ? "PUN" : "PrezziZonali";
  const { status, body } = await gmeApiGet(session, API_PATH, {
    DataInizio: dataCompact, DataFine: dataCompact,
    Granularita: "h", Mercato: "MGP", Zona: zona, Tipologia: tipologia,
  });
  if (status !== 200) throw new Error(`GME ${zona} HTTP ${status}`);
  const arr = JSON.parse(body);
  if (!Array.isArray(arr)) throw new Error(`GME ${zona} non array`);
  return arr.map((r) => GmeRowSchema.parse(r));
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY richieste in .env.local");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const session = await bootstrapGmeDnnSession(PAGE_URL);
  console.log("DNN session ok", { tabId: session.tabId });

  const slugMap: Record<Zone | "NATIONAL", string> = {
    NATIONAL: "pun",
    NORD: "pun-zona-nord", CNOR: "pun-zona-cnor", CSUD: "pun-zona-csud",
    SUD: "pun-zona-sud", SICI: "pun-zona-sici", SARD: "pun-zona-sard",
  };
  const slugs = Object.values(slugMap);
  const { data: assets } = await db.from("assets").select("id, slug").in("slug", slugs);
  if (!assets) throw new Error("assets non seedati");
  const slugToId = new Map(assets.map((a) => [a.slug as string, a.id as number]));

  const end = addDaysIso(todayIso(), -1);
  let date = START_DATE;
  let totalRows = 0, totalDays = 0, emptyDays = 0;
  const t0 = Date.now();

  while (date <= end) {
    try {
      const punRows = await fetchSeries(session, "PUN", compactDate(date));
      await sleep(SLEEP_MS);
      if (punRows.length === 0) {
        emptyDays++;
        date = addDaysIso(date, 1);
        continue;
      }
      const zoneRows: Record<string, GmeRow[]> = {};
      for (const z of ZONES) {
        zoneRows[z] = await fetchSeries(session, z, compactDate(date));
        await sleep(SLEEP_MS);
      }
      const combined = {
        source: "gme-mgp-pun" as const, url_base: GME_BASE,
        fetched_at: new Date().toISOString(), data_date: date,
        pun: punRows, zones: zoneRows,
      };
      const parsed = parseGmePun(JSON.stringify(combined));
      const rows: Array<{
        asset_id: number; observed_at: string; value: number;
        granularity: string; extra: Record<string, unknown>;
      }> = [];
      for (const p of parsed.pun_national) {
        const id = slugToId.get("pun");
        if (id) rows.push({
          asset_id: id, observed_at: hourToIso(date, p.hour),
          value: p.value, granularity: "hourly", extra: { source_hour: p.hour, backfill: true },
        });
      }
      for (const z of ZONES) {
        const id = slugToId.get(slugMap[z]);
        for (const p of parsed.zonal[z] ?? []) {
          if (id) rows.push({
            asset_id: id, observed_at: hourToIso(date, p.hour),
            value: p.value, granularity: "hourly",
            extra: { source_hour: p.hour, zone: z, backfill: true },
          });
        }
      }
      const { error } = await db.from("price_observations").upsert(rows, {
        onConflict: "asset_id,observed_at",
      });
      if (error) throw new Error(`upsert ${date}: ${error.message}`);
      totalRows += rows.length;
      totalDays++;
      if (totalDays % PROGRESS_EVERY_DAYS === 0) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(`[${date}] +${rows.length} rows | total ${totalRows} | ${totalDays}d in ${elapsed}s | empty: ${emptyDays}`);
      }
    } catch (err) {
      console.error(`[${date}] errore:`, (err as Error).message);
    }
    date = addDaysIso(date, 1);
  }

  console.log("DONE", { totalRows, totalDays, emptyDays, elapsedSec: ((Date.now() - t0) / 1000).toFixed(0) });

  // Refresh MV
  const { error: refreshErr } = await db.rpc("refresh_mv_latest_price_per_asset");
  if (refreshErr) console.warn("refresh MV warning:", refreshErr.message);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

**Step 2: Aggiungi script in `package.json`**

```json
"backfill:gme-pun": "tsx scripts/backfill-gme-pun.ts"
```

**Step 3: Verifica .env.local**

```bash
grep -E '^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=' .env.local
```
Expected: 2 righe presenti. Se mancanti, l'utente le configura.

**Step 4: Esecuzione (smoke su 1 giorno)**

Per smoke-test rapido prima del run completo, modifica temporaneamente `START_DATE` a ieri e `end` a ieri, lancia, verifica una manciata di righe in DB:

```bash
npm run backfill:gme-pun
```
Expected: log `DONE { totalRows: ~168, totalDays: 1 }`. Verifica con:

```sql
SELECT COUNT(*) FROM price_observations WHERE extra->>'backfill' = 'true';
```

**Step 5: Run completo (5 anni)**

Ripristina `START_DATE = "2021-05-07"`, lancia. Aspetta ~30-40 minuti.

```bash
npm run backfill:gme-pun
```
Expected: `totalDays ≈ 1825`, `totalRows ≈ 300k`. Tieni d'occhio gli errori — se GME blocca, lo script salta il giorno e continua.

**Step 6: Commit**

```bash
git add scripts/backfill-gme-pun.ts package.json
git commit -m "feat(backfill): script one-shot per backfill PUN 5 anni dall'archivio GME"
```

---

## Task 4 — Pagina indice: leggi `?tf=` e query bucketata

**Files:**
- Modify: `app/[locale]/indice/[slug]/page.tsx`
- Create: `supabase/migrations/20260507000000_rpc_get_pun_series.sql`

**Step 1: Crea funzione RPC Postgres per query bucketata**

Crea `supabase/migrations/20260507000000_rpc_get_pun_series.sql`:

```sql
-- RPC per chart PUN bucketato. anon-readable.
-- bucket: 'month' | 'day' | 'raw'
-- interval_sql: literal accettato da NOW() - INTERVAL '<x>'
CREATE OR REPLACE FUNCTION get_pun_series(
  p_asset_id BIGINT,
  p_interval TEXT,
  p_bucket TEXT
)
RETURNS TABLE(observed_at TIMESTAMPTZ, value NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_bucket = 'raw' THEN
    RETURN QUERY EXECUTE format(
      'SELECT observed_at, value FROM price_observations
       WHERE asset_id = $1
         AND observed_at >= NOW() - INTERVAL %L
         AND observed_at <= NOW()
       ORDER BY observed_at',
      p_interval
    ) USING p_asset_id;
  ELSIF p_bucket IN ('day', 'month') THEN
    RETURN QUERY EXECUTE format(
      'SELECT date_trunc(%L, observed_at) AS observed_at,
              AVG(value)::numeric AS value
       FROM price_observations
       WHERE asset_id = $1
         AND observed_at >= NOW() - INTERVAL %L
         AND observed_at <= NOW()
       GROUP BY 1
       ORDER BY 1',
      p_bucket, p_interval
    ) USING p_asset_id;
  ELSE
    RAISE EXCEPTION 'invalid bucket: %', p_bucket;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION get_pun_series(BIGINT, TEXT, TEXT) TO anon;
```

Applica la migration su Supabase via dashboard SQL editor (la branch principale ha già pg_cron — aggiungere la function è low-risk).

**Step 2: Modifica page.tsx**

In `app/[locale]/indice/[slug]/page.tsx`:

- Importa `resolveTimeframe`, `TIMEFRAMES`
- Cambia signature da `params: Promise<{...}>` aggiungendo `searchParams: Promise<{ tf?: string }>`
- Sostituisci la query history con chiamata RPC `get_pun_series(asset_id, intervalSql, bucket)`
- Rimuovi `oneWeekAgo`/`nowIso` (tutto dentro RPC)
- Computa `latestPoint` separatamente: query rapida per orario raw ultimo `<=now()` (necessaria perché sui bucket aggregati l'ultimo punto è "media del giorno/mese", non l'ora corrente)
- Rendi `<TimeframeSelector active={tf.id} basePath="/it/indice/pun" />` sopra al chart
- Passa `tf.chartTitle` al chart o titolo `<h2>`

Diff approssimato:

```tsx
import { resolveTimeframe } from "@/lib/timeframes";
import { TimeframeSelector } from "@/components/chart/TimeframeSelector";

export default async function IndicePage({
  params, searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ tf?: string }>;
}) {
  const { slug } = await params;
  const { tf: tfParam } = await searchParams;
  const tf = resolveTimeframe(tfParam);
  // ...
  // Big-number card: query last hourly point separately
  const { data: latestRow } = await supabase
    .from("price_observations")
    .select("observed_at, value")
    .eq("asset_id", assetMeta.asset_id)
    .lte("observed_at", new Date().toISOString())
    .order("observed_at", { ascending: false })
    .limit(2);
  const latestPoint = latestRow?.[0] ? { observed_at: String(latestRow[0].observed_at), value: Number(latestRow[0].value) } : null;
  const prevValue = latestRow?.[1] ? Number(latestRow[1].value) : undefined;

  // Chart series: bucketed via RPC
  const { data: series } = await supabase.rpc("get_pun_series", {
    p_asset_id: assetMeta.asset_id,
    p_interval: tf.intervalSql,
    p_bucket: tf.bucket,
  });
  const points = (series ?? []).map((p: { observed_at: string; value: number | string }) => ({
    observed_at: String(p.observed_at),
    value: Number(p.value),
  }));
  // ... resto (latestPoint check, render)

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <header>...</header>
      <LatestValueCard ... />
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl font-semibold">{tf.chartTitle}</h2>
          <TimeframeSelector active={tf.id} basePath={`/it/indice/${slug}`} />
        </div>
        <PriceChart points={points} unit={assetMeta.unit} />
      </section>
      <FaqSection slug={slug} />
      <CtaToEnergiapro campaign={`indice-${slug}`} />
    </div>
  );
}
```

**Step 3: Verifica build locale**

```bash
npm run build 2>&1 | tail -20
```
Expected: build success, niente type errors.

**Step 4: Smoke test su /it/indice/pun?tf=1S**

```bash
npm run dev
```
Apri:
- `http://localhost:3000/it/indice/pun` → default 5Y, chart con punti mensili
- `http://localhost:3000/it/indice/pun?tf=1G` → 24 punti orari
- `http://localhost:3000/it/indice/pun?tf=foo` → fallback 5Y

**Step 5: Commit**

```bash
git add app/[locale]/indice/[slug]/page.tsx supabase/migrations/20260507000000_rpc_get_pun_series.sql
git commit -m "feat(indice-pun): query bucketata via RPC get_pun_series + searchParams.tf"
```

---

## Task 5 — `<TimeframeSelector>` component

**Files:**
- Create: `components/chart/TimeframeSelector.tsx`

**Step 1: Implementa**

```tsx
import Link from "next/link";
import { TIMEFRAMES, type TimeframeId } from "@/lib/timeframes";
import { cn } from "@/lib/utils";

export function TimeframeSelector({
  active,
  basePath,
}: {
  active: TimeframeId;
  basePath: string;
}) {
  return (
    <nav
      aria-label="Periodo"
      className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card/40 p-1"
    >
      {TIMEFRAMES.map((t) => {
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={`${basePath}?tf=${t.id}`}
            scroll={false}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

**Step 2: Smoke visuale**

Ricarica `/it/indice/pun`. Il selector compare in alto a destra del titolo chart, pill 5Y attivo. Click su `1G` → URL diventa `?tf=1G`, chart si aggiorna a 24 ore.

**Step 3: Commit**

```bash
git add components/chart/TimeframeSelector.tsx
git commit -m "feat(timeframe-selector): pill row Next Link con stato attivo"
```

---

## Task 6 — `PriceChart` tooltip & line-mode per aggregati

**Files:**
- Modify: `components/chart/PriceChart.tsx`

**Step 1: Aggiungi prop `mode` per cambiare label tooltip**

Modifica props per accettare un `bucket: "month" | "day" | "raw"`:

```tsx
export function PriceChart({
  points, unit, bucket = "raw",
}: {
  points: PricePoint[];
  unit: string;
  bucket?: "month" | "day" | "raw";
}) {
```

E nella `priceFormatter` non c'è bisogno di modifiche, ma personalizzare il tooltip è complicato in lightweight-charts. Per Slice 1 di questa feature accontentiamoci della y-axis label invariata. Cambia solo il `lineColor`/visualizzazione coerente.

In realtà per ora bastano i dati; il chart è già bello. Salta questo task — il `chartTitle` esterno spiega già il contesto.

**Step 2: Skip — non serve modificare il chart per la prima release**

Non commit.

---

## Task 7 — Verifica finale + merge

**Step 1: Verifica visuale completa**

```bash
npm run dev
```
- `/` → home con card grande
- `/it/indice/pun` → 5Y selector attivo, chart pieno (post-backfill)
- Clicca tutti i pill 5Y/1Y/6M/3M/1M/1S/1G — verifica che il chart si aggiorni e il pill attivo cambi
- FAQ Q4 → testo nuovo senza energiapro
- Mobile (Chrome devtools): selector scrolla orizzontale OK

**Step 2: Push branch + merge in main**

```bash
git push
# da repo principale (non worktree):
git -C ../../.. merge --no-ff claude/wizardly-mccarthy-556b3a -m "merge: Slice 1.5 — selector timeframe PUN + backfill 5Y"
git -C ../../.. push origin main
```

**Step 3: Smoke su prod**

Dopo Netlify deploy (1-2 min): `https://energyindex.it/it/indice/pun` con tutti i timeframe funzionanti.

---

## Out of scope (rinviato)

- Custom date picker
- Materialized view per aggregati
- Selettore zonale
- DST-aware backfill
- Tooltip custom con label "Media mese"
