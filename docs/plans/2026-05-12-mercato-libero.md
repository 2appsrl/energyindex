# Slice 4 — Mercato Libero ARERA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the public `/it/mercato-libero` page showing 4 aggregate stat cards (luce fissa/var, gas fissa/var) for ARERA PLACET offers, with 1Y trend chart and home banner promo.

**Architecture:** Daily ETL downloads 2 PLACET CSVs (luce + gas), parses via shared `parsePlacetElectric`/`parsePlacetGas` (promoted from spike), upserts rows in `arera_offers`, then computes 4 aggregate rows into `energy_index_aggregates`. Page reads from MV + aggregates table. 1Y backfill via env-driven script.

**Tech Stack:** Next.js 16 RSC, Supabase Postgres + Edge Functions (Deno), pg_cron, Vitest, lightweight-charts.

**Design doc:** `docs/plans/2026-05-12-mercato-libero-design.md`

---

## Task 1 — Parser ARERA promosso a shared

**Files:**
- Create: `supabase/functions/_shared/parsers/arera-placet.ts`
- Modify: `spikes/arera-offers.ts` (re-export from shared)
- Modify: `tests/parsers/arera-offers.test.ts` (import path)

Single-source-of-truth pattern (gme-pun / gme-psv). Promosso codice da spike. Mantiene il pattern dei test esistenti.

**Step 1: Create `supabase/functions/_shared/parsers/arera-placet.ts`**

Copia il blocco (linee ~75-279 dello spike) — schemi PLACET_E_COLS, PLACET_G_COLS, interface `PlacetOffer`, `parsePlacetElectric`, `parsePlacetGas`, `parsePlacetGeneric`, `parseNumOrNaN`, `pickNumber`, `AggregateStats`, `quantile`, `statsFor`. Aggiungi top header:

```ts
/**
 * ARERA Portale Offerte PLACET parser — pure, runtime-agnostic.
 *
 * Single source of truth importato sia dai test Vitest (Node runtime) sia
 * dall'Edge Function di ingestion (Deno runtime). Nessun I/O qui.
 *
 * Promosso da spikes/arera-offers.ts (Slice 4). Lo spike reimporta queste
 * export e mantiene solo main() + URL builders.
 */
```

Export pubblicamente: `parsePlacetElectric`, `parsePlacetGas`, `statsFor`, `PlacetOffer`, `AggregateStats`.

**Step 2: Update spike**

In `spikes/arera-offers.ts`, sostituisci il blocco "Parsers (puri, testabili)" + "Aggregati" con:

```ts
// Single source of truth: parser e statsFor promossi.
export {
  parsePlacetElectric,
  parsePlacetGas,
  statsFor,
  type PlacetOffer,
  type AggregateStats,
} from "../supabase/functions/_shared/parsers/arera-placet.js";
```

Mantieni: `buildPlacetUrl`, `buildMliberoUrl`, `fetchText`, `main()`, costanti BASE/USER_AGENT.

**Step 3: Update test import**

In `tests/parsers/arera-offers.test.ts`, sostituisci:
```ts
import {
  parsePlacetElectric,
  parsePlacetGas,
  statsFor,
  buildPlacetUrl,
  buildMliberoUrl,
} from "../../spikes/arera-offers.js";
```
con:
```ts
import {
  parsePlacetElectric,
  parsePlacetGas,
  statsFor,
} from "../../supabase/functions/_shared/parsers/arera-placet.js";
import {
  buildPlacetUrl,
  buildMliberoUrl,
} from "../../spikes/arera-offers.js";
```

**Step 4: Run tests + typecheck**

```bash
npx vitest run tests/parsers/arera-offers.test.ts
```
Expected: tests still pass (same fixture, same parser logic).

```bash
npx vitest run
```
Expected: 38 total (no regression).

```bash
npx tsc --noEmit
```
Expected: clean.

**Step 5: Commit**

```bash
git add supabase/functions/_shared/parsers/arera-placet.ts spikes/arera-offers.ts tests/parsers/arera-offers.test.ts
git commit -m "feat(parser-arera): promuove parser PLACET da spike a supabase/functions/_shared"
```

---

## Task 2 — UNIQUE constraint on `arera_offers`

**Files:**
- Create: `supabase/migrations/20260512000000_arera_offers_unique.sql`

Per UPSERT idempotente nell'ETL serve un UNIQUE su `(offer_code, valid_from)`. Lo schema attuale non l'ha (vedi `20260505000001_schema.sql:46-70`).

**Step 1: Migration**

```sql
-- Slice 4 ARERA: UNIQUE constraint per UPSERT idempotente in ETL.
-- offer_code da solo non basta perche' la stessa offerta puo' avere piu'
-- versioni con valid_from diversi (versioning).

ALTER TABLE arera_offers
  ADD CONSTRAINT arera_offers_offer_code_valid_from_unique
  UNIQUE (offer_code, valid_from);
```

**Step 2: Apply via Supabase MCP** (controller). NON eseguire localmente.

**Step 3: Commit**

```bash
git add supabase/migrations/20260512000000_arera_offers_unique.sql
git commit -m "feat(arera): UNIQUE (offer_code, valid_from) per UPSERT idempotente"
```

---

## Task 3 — `lib/arera-aggregates.ts` (type + display labels)

**Files:**
- Create: `lib/arera-aggregates.ts`
- Create: `tests/lib/arera-aggregates.test.ts`

TDD. Mapping aggregato_slug → {commodity, price_type, unit, displayName, referenceAssetSlug}.

**Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  AGGREGATE_SLUGS,
  resolveAggregate,
  type AggregateSlug,
} from "@/lib/arera-aggregates";

describe("resolveAggregate", () => {
  it("returns 4 known aggregate definitions", () => {
    const slugs: AggregateSlug[] = [
      "mercato-libero-luce-fissa",
      "mercato-libero-luce-variabile",
      "mercato-libero-gas-fissa",
      "mercato-libero-gas-variabile",
    ];
    for (const s of slugs) {
      const a = resolveAggregate(s);
      expect(a.slug).toBe(s);
    }
  });

  it("maps luce-fissa to commodity=electricity, price_type=fisso, unit €/kWh, reference PUN", () => {
    const a = resolveAggregate("mercato-libero-luce-fissa");
    expect(a.commodity).toBe("electricity");
    expect(a.priceType).toBe("fisso");
    expect(a.unit).toBe("€/kWh");
    expect(a.referenceAssetSlug).toBe("pun");
  });

  it("maps gas-variabile to commodity=gas, price_type=variabile, unit €/Smc, reference PSV", () => {
    const a = resolveAggregate("mercato-libero-gas-variabile");
    expect(a.commodity).toBe("gas");
    expect(a.priceType).toBe("variabile");
    expect(a.unit).toBe("€/Smc");
    expect(a.referenceAssetSlug).toBe("psv");
  });

  it("AGGREGATE_SLUGS exposes the 4 slugs in display order (luce-fissa, luce-var, gas-fissa, gas-var)", () => {
    expect(AGGREGATE_SLUGS.map((a) => a.slug)).toEqual([
      "mercato-libero-luce-fissa",
      "mercato-libero-luce-variabile",
      "mercato-libero-gas-fissa",
      "mercato-libero-gas-variabile",
    ]);
  });

  it("each aggregate has a displayName", () => {
    for (const a of AGGREGATE_SLUGS) {
      expect(a.displayName.length).toBeGreaterThan(0);
    }
  });
});
```

**Step 2: Run, verify FAIL**

```bash
npx vitest run tests/lib/arera-aggregates.test.ts
```
Expected: module-not-found.

**Step 3: Implement `lib/arera-aggregates.ts`**

```ts
export type AggregateSlug =
  | "mercato-libero-luce-fissa"
  | "mercato-libero-luce-variabile"
  | "mercato-libero-gas-fissa"
  | "mercato-libero-gas-variabile";

export type Commodity = "electricity" | "gas";
export type PriceType = "fisso" | "variabile";

export interface AggregateDefinition {
  slug: AggregateSlug;
  commodity: Commodity;
  priceType: PriceType;
  /** Unita' di misura del prezzo retail comparabile. */
  unit: string;
  /** Nome lungo per heading/card title. */
  displayName: string;
  /** Etichetta corta per legenda chart. */
  displayShort: string;
  /** Asset wholesale di riferimento per spread/comparison. */
  referenceAssetSlug: string;
}

export const AGGREGATE_SLUGS: readonly AggregateDefinition[] = [
  {
    slug: "mercato-libero-luce-fissa",
    commodity: "electricity",
    priceType: "fisso",
    unit: "€/kWh",
    displayName: "Luce — Prezzo Fisso",
    displayShort: "Luce fissa",
    referenceAssetSlug: "pun",
  },
  {
    slug: "mercato-libero-luce-variabile",
    commodity: "electricity",
    priceType: "variabile",
    unit: "€/kWh",
    displayName: "Luce — Prezzo Variabile",
    displayShort: "Luce variabile",
    referenceAssetSlug: "pun",
  },
  {
    slug: "mercato-libero-gas-fissa",
    commodity: "gas",
    priceType: "fisso",
    unit: "€/Smc",
    displayName: "Gas — Prezzo Fisso",
    displayShort: "Gas fisso",
    referenceAssetSlug: "psv",
  },
  {
    slug: "mercato-libero-gas-variabile",
    commodity: "gas",
    priceType: "variabile",
    unit: "€/Smc",
    displayName: "Gas — Prezzo Variabile",
    displayShort: "Gas variabile",
    referenceAssetSlug: "psv",
  },
] as const;

const BY_SLUG = new Map<string, AggregateDefinition>(
  AGGREGATE_SLUGS.map((a) => [a.slug, a]),
);

export function resolveAggregate(slug: string): AggregateDefinition {
  const a = BY_SLUG.get(slug);
  if (!a) throw new Error(`unknown aggregate slug: ${slug}`);
  return a;
}
```

**Step 4: Run, verify PASS**

```bash
npx vitest run
```
Expected: 43 total (38 + 5 new).

**Step 5: Commit**

```bash
git add lib/arera-aggregates.ts tests/lib/arera-aggregates.test.ts
git commit -m "feat(arera-aggregates): mapping AggregateSlug -> {commodity, priceType, reference}"
```

---

## Task 4 — ETL edge function `etl-arera-placet`

**Files:**
- Create: `supabase/functions/etl-arera-placet/index.ts`

Daily ETL: scarica 2 CSV PLACET (E + G), parse, upsert in `arera_offers`, computa 4 aggregati e upsert in `energy_index_aggregates`.

**Step 1: Implement**

```ts
/**
 * Edge Function `etl-arera-placet` — Slice 4.
 *
 * 1) Scarica i 2 CSV PLACET (Elettrico + Gas) per oggi.
 *    Fallback a ieri se 404 (ARERA refresh ~22:30 UTC quindi prima della
 *    mezzanotte UTC + cron 00:00 il file di oggi e' gia' disponibile).
 * 2) Parse via parsePlacetElectric / parsePlacetGas (shared parser).
 * 3) UPSERT righe in arera_offers con onConflict (offer_code, valid_from).
 * 4) Computa 4 aggregati (mediana, p25, p75, min, max, n) e UPSERT in
 *    energy_index_aggregates con onConflict (aggregate_slug, computed_at).
 *
 * Invocata da pg_cron alle 00:00 UTC. Niente auth utente: --no-verify-jwt.
 */
import { runEtl } from "../_shared/etl-runner.ts";
import {
  parsePlacetElectric,
  parsePlacetGas,
  statsFor,
  type PlacetOffer,
} from "../_shared/parsers/arera-placet.ts";
import { dbServiceRole } from "../_shared/db.ts";

const ARERA_BASE = "https://www.ilportaleofferte.it";
const USER_AGENT =
  "EnergyIndex/0.1 (commerciale@deagroup.biz; +https://energyindex.it)";

function isoDateInRome(d: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function buildPlacetUrl(isoDate: string, kind: "E" | "G"): string {
  const [yyyy, mm, dd] = isoDate.split("-");
  const monthNoZero = String(parseInt(mm, 10));
  const compact = `${yyyy}${mm}${dd}`;
  return `${ARERA_BASE}/portaleOfferte/resources/opendata/csv/offerte/${yyyy}_${monthNoZero}/PO_Offerte_${kind}_PLACET_${compact}.csv`;
}

/** parse 'gg/mm/yyyy' → 'yyyy-mm-dd' ISO; null se invalido o vuoto */
function ddmmyyyyToIso(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

async function fetchCsv(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  return { status: res.status, body: await res.text() };
}

async function fetchPlacetForDate(
  isoDate: string,
  kind: "E" | "G",
): Promise<string | null> {
  const url = buildPlacetUrl(isoDate, kind);
  const r = await fetchCsv(url);
  if (r.status === 200) return r.body;
  return null;
}

function offersToRows(
  offers: PlacetOffer[],
  commodity: "electricity" | "gas",
  asOfIsoDate: string,
) {
  // valid_from = data_inizio (gg/mm/yyyy) della riga, fallback a asOfIsoDate
  // valid_to   = data_fine (gg/mm/yyyy), null se vuota
  return offers
    .filter((o) => Number.isFinite(o.prezzo_energia))
    .map((o) => {
      const validFromIso = ddmmyyyyToIso(o.data_inizio) ?? asOfIsoDate;
      const validToIso = ddmmyyyyToIso(o.data_fine);
      const priceType: "fisso" | "variabile" =
        o.tipo_offerta === "prezzo fisso" ? "fisso" : "variabile";
      return {
        offer_code: o.codice,
        supplier: o.vendor,
        commodity,
        price_type: priceType,
        price_value: o.prezzo_energia,
        valid_from: `${validFromIso}T00:00:00+01:00`,
        valid_to: validToIso ? `${validToIso}T23:59:59+01:00` : null,
        raw: o as unknown as Record<string, unknown>,
      };
    });
}

Deno.serve(async () => {
  return runEtl("arera-placet", async (ctx) => {
    let asOf = isoDateInRome();

    // 1. Scarica E
    let csvE = await fetchPlacetForDate(asOf, "E");
    if (csvE === null) {
      const yesterday = addDaysIso(asOf, -1);
      ctx.log("today E missing, fallback to yesterday", {
        from: asOf,
        to: yesterday,
      });
      csvE = await fetchPlacetForDate(yesterday, "E");
      asOf = yesterday;
    }
    if (csvE === null) throw new Error("ARERA PLACET E non disponibile");

    // 2. Scarica G (stessa data di E per coerenza)
    let csvG = await fetchPlacetForDate(asOf, "G");
    if (csvG === null) {
      ctx.log("G missing for asOf, retry without fallback", { asOf });
      csvG = await fetchPlacetForDate(asOf, "G");
    }
    if (csvG === null) throw new Error("ARERA PLACET G non disponibile");

    const offersE = parsePlacetElectric(csvE);
    const offersG = parsePlacetGas(csvG);
    ctx.log("parsed", { e_offers: offersE.length, g_offers: offersG.length });

    const db = dbServiceRole();

    // 3. UPSERT arera_offers
    const rowsE = offersToRows(offersE, "electricity", asOf);
    const rowsG = offersToRows(offersG, "gas", asOf);
    const allRows = [...rowsE, ...rowsG];
    if (allRows.length > 0) {
      const { error } = await db
        .from("arera_offers")
        .upsert(allRows, { onConflict: "offer_code,valid_from" });
      if (error) throw new Error(`upsert arera_offers: ${error.message}`);
    }
    ctx.log("upserted arera_offers", { rows: allRows.length });

    // 4. Computa 4 aggregati per asOf
    const aggregates: Array<{
      slug: string;
      offers: PlacetOffer[];
      unit: string;
    }> = [
      {
        slug: "mercato-libero-luce-fissa",
        offers: offersE.filter((o) => o.tipo_offerta === "prezzo fisso"),
        unit: "€/kWh",
      },
      {
        slug: "mercato-libero-luce-variabile",
        offers: offersE.filter((o) => o.tipo_offerta === "prezzo variabile"),
        unit: "€/kWh",
      },
      {
        slug: "mercato-libero-gas-fissa",
        offers: offersG.filter((o) => o.tipo_offerta === "prezzo fisso"),
        unit: "€/Smc",
      },
      {
        slug: "mercato-libero-gas-variabile",
        offers: offersG.filter((o) => o.tipo_offerta === "prezzo variabile"),
        unit: "€/Smc",
      },
    ];

    const aggRows = aggregates.map((a) => {
      const s = statsFor(a.offers);
      return {
        aggregate_slug: a.slug,
        computed_at: asOf,
        median: Number.isFinite(s.median) ? s.median : 0,
        p25: Number.isFinite(s.p25) ? s.p25 : null,
        p75: Number.isFinite(s.p75) ? s.p75 : null,
        min: Number.isFinite(s.min) ? s.min : 0,
        max: Number.isFinite(s.max) ? s.max : 0,
        sample_size: s.n,
        unit: a.unit,
      };
    });
    const { error: aggErr } = await db
      .from("energy_index_aggregates")
      .upsert(aggRows, { onConflict: "aggregate_slug,computed_at" });
    if (aggErr) throw new Error(`upsert aggregates: ${aggErr.message}`);
    ctx.log("upserted aggregates", { rows: aggRows.length });

    return {
      rows_ingested: allRows.length,
      metadata: { as_of: asOf, aggregates: aggRows.length },
    };
  });
});
```

**Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean (the supabase/functions tsc include path may not pick this up; report only NEW errors).

**Step 3: Commit**

```bash
git add supabase/functions/etl-arera-placet/index.ts
git commit -m "feat(etl-arera): edge function daily PLACET ETL + computa 4 aggregati"
```

NB: deploy via MCP, done in Task 10.

---

## Task 5 — pg_cron schedule doc

**Files:**
- Create: `supabase/migrations/20260512000001_pg_cron_etl_arera.sql`

Doc-only (la `cron.schedule` con service-role-key viene applicata via MCP/SQL editor).

**Step 1: Migration**

```sql
-- ============================================================
-- ETL pg_cron schedule for etl-arera-placet
-- ============================================================
-- Doc-only migration (no DDL).
--
-- Active schedule:
-- jobname:  etl-arera-placet-daily
-- schedule: '0 0 * * *' (UTC) = 02:00 CEST (summer) / 01:00 CET (winter)
--           Sicuro dopo refresh ARERA giornaliero ~22:30 UTC.
-- target:   https://epbluenhmdwgmgcewrsf.supabase.co/functions/v1/etl-arera-placet
-- auth:     Bearer <SUPABASE_SERVICE_ROLE_KEY>
--
-- How to re-apply (Supabase Dashboard SQL Editor):
--
--   SELECT cron.schedule(
--     'etl-arera-placet-daily',
--     '0 0 * * *',
--     $$
--     SELECT net.http_post(
--       url := 'https://epbluenhmdwgmgcewrsf.supabase.co/functions/v1/etl-arera-placet',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
--       ),
--       timeout_milliseconds := 120000
--     ) as request_id;
--     $$
--   );

SELECT 1 AS pg_cron_etl_arera_documented;
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260512000001_pg_cron_etl_arera.sql
git commit -m "docs(cron-arera): documentation-only migration per pg_cron etl-arera-placet"
```

---

## Task 6 — Backfill script `backfill-arera-placet.ts`

**Files:**
- Create: `scripts/backfill-arera-placet.ts`
- Modify: `package.json`

**Step 1: Implement (clone PUN/PSV pattern)**

```ts
/**
 * One-shot backfill ARERA PLACET 1Y.
 *
 * Itera da BACKFILL_START a ieri, scarica E + G CSV per ogni giorno,
 * parse, upsert in arera_offers, computa aggregati post-loop (per giorno).
 *
 * Idempotente. Env-driven: BACKFILL_START, BACKFILL_END, BACKFILL_SLEEP_MS.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import {
  parsePlacetElectric,
  parsePlacetGas,
  statsFor,
  type PlacetOffer,
} from "../supabase/functions/_shared/parsers/arera-placet.js";

const ARERA_BASE = "https://www.ilportaleofferte.it";
const USER_AGENT =
  "EnergyIndex/0.1 (commerciale@deagroup.biz; +https://energyindex.it)";

const START_DATE = process.env.BACKFILL_START ?? (() => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
})();
const END_DATE_OVERRIDE = process.env.BACKFILL_END ?? null;
const SLEEP_MS = Number(process.env.BACKFILL_SLEEP_MS ?? 500);
const PROGRESS_EVERY_DAYS = 30;

function todayIso() { return new Date().toISOString().slice(0, 10); }
function addDaysIso(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function buildPlacetUrl(isoDate: string, kind: "E" | "G"): string {
  const [yyyy, mm, dd] = isoDate.split("-");
  const monthNoZero = String(parseInt(mm, 10));
  const compact = `${yyyy}${mm}${dd}`;
  return `${ARERA_BASE}/portaleOfferte/resources/opendata/csv/offerte/${yyyy}_${monthNoZero}/PO_Offerte_${kind}_PLACET_${compact}.csv`;
}

function ddmmyyyyToIso(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

async function fetchCsv(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  return { status: res.status, body: await res.text() };
}

function offersToRows(
  offers: PlacetOffer[],
  commodity: "electricity" | "gas",
  asOfIsoDate: string,
) {
  return offers
    .filter((o) => Number.isFinite(o.prezzo_energia))
    .map((o) => {
      const vfIso = ddmmyyyyToIso(o.data_inizio) ?? asOfIsoDate;
      const vtIso = ddmmyyyyToIso(o.data_fine);
      const priceType: "fisso" | "variabile" =
        o.tipo_offerta === "prezzo fisso" ? "fisso" : "variabile";
      return {
        offer_code: o.codice,
        supplier: o.vendor,
        commodity,
        price_type: priceType,
        price_value: o.prezzo_energia,
        valid_from: `${vfIso}T00:00:00+01:00`,
        valid_to: vtIso ? `${vtIso}T23:59:59+01:00` : null,
        raw: o as unknown as Record<string, unknown>,
      };
    });
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY richiesti");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const end = END_DATE_OVERRIDE ?? addDaysIso(todayIso(), -1);
  let date = START_DATE;
  let totalRows = 0, totalDays = 0, emptyDays = 0, errorDays = 0;
  const t0 = Date.now();

  console.log("backfill start", { from: START_DATE, to: end, sleepMs: SLEEP_MS });

  while (date <= end) {
    try {
      const [rE, rG] = await Promise.all([
        fetchCsv(buildPlacetUrl(date, "E")),
        fetchCsv(buildPlacetUrl(date, "G")),
      ]);
      await sleep(SLEEP_MS);

      if (rE.status !== 200 && rG.status !== 200) {
        emptyDays++;
        date = addDaysIso(date, 1);
        continue;
      }

      const offersE = rE.status === 200 ? parsePlacetElectric(rE.body) : [];
      const offersG = rG.status === 200 ? parsePlacetGas(rG.body) : [];

      const rows = [
        ...offersToRows(offersE, "electricity", date),
        ...offersToRows(offersG, "gas", date),
      ];

      if (rows.length > 0) {
        const { error } = await db
          .from("arera_offers")
          .upsert(rows, { onConflict: "offer_code,valid_from" });
        if (error) throw new Error(`upsert ${date}: ${error.message}`);
        totalRows += rows.length;
      }

      // Aggregati per il giorno
      const aggs = [
        { slug: "mercato-libero-luce-fissa",     offers: offersE.filter((o) => o.tipo_offerta === "prezzo fisso"),     unit: "€/kWh" },
        { slug: "mercato-libero-luce-variabile", offers: offersE.filter((o) => o.tipo_offerta === "prezzo variabile"), unit: "€/kWh" },
        { slug: "mercato-libero-gas-fissa",      offers: offersG.filter((o) => o.tipo_offerta === "prezzo fisso"),     unit: "€/Smc" },
        { slug: "mercato-libero-gas-variabile",  offers: offersG.filter((o) => o.tipo_offerta === "prezzo variabile"), unit: "€/Smc" },
      ];
      const aggRows = aggs
        .filter((a) => a.offers.length > 0)
        .map((a) => {
          const s = statsFor(a.offers);
          return {
            aggregate_slug: a.slug,
            computed_at: date,
            median: s.median, p25: s.p25, p75: s.p75, min: s.min, max: s.max,
            sample_size: s.n, unit: a.unit,
          };
        });
      if (aggRows.length > 0) {
        const { error } = await db
          .from("energy_index_aggregates")
          .upsert(aggRows, { onConflict: "aggregate_slug,computed_at" });
        if (error) throw new Error(`upsert aggregates ${date}: ${error.message}`);
      }

      totalDays++;
      if (totalDays % PROGRESS_EVERY_DAYS === 0) {
        const el = ((Date.now() - t0) / 1000).toFixed(0);
        console.log(`[${date}] +${rows.length} | total ${totalRows} / ${totalDays}d in ${el}s | empty ${emptyDays} | err ${errorDays}`);
      }
    } catch (err) {
      errorDays++;
      console.error(`[${date}] errore: ${(err as Error).message}`);
    }
    date = addDaysIso(date, 1);
  }

  const el = ((Date.now() - t0) / 1000).toFixed(0);
  console.log("DONE", { totalRows, totalDays, emptyDays, errorDays, elapsedSec: el });
}

main().catch((e) => { console.error(e); process.exit(1); });
```

**Step 2: Add npm script**

In `package.json` scripts, accanto a `backfill:gme-psv`:
```json
"backfill:arera-placet": "tsx scripts/backfill-arera-placet.ts"
```

**Step 3: Typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add scripts/backfill-arera-placet.ts package.json
git commit -m "feat(backfill-arera): script backfill PLACET 1Y (env-driven, idempotente)"
```

**Step 5: Esecuzione** → controller, Task 10.

---

## Task 7 — Pagina `/it/mercato-libero`

**Files:**
- Create: `app/[locale]/mercato-libero/page.tsx`
- Create: `components/mercato-libero/AggregateCard.tsx`
- Create: `components/mercato-libero/AggregateTrendChart.tsx`

**Step 1: Implement `components/mercato-libero/AggregateCard.tsx`**

Card mini-vetrina per ogni aggregato. Pattern simile a `PriceShowcaseCard`.

```tsx
import { cn } from "@/lib/utils";

export interface AggregateCardProps {
  title: string;
  median: number | null;
  p25: number | null;
  p75: number | null;
  sampleSize: number;
  unit: string;
  /** Spread vs wholesale reference, percent. Optional. */
  spreadPct?: number | null;
}

export function AggregateCard({
  title, median, p25, p75, sampleSize, unit, spreadPct,
}: AggregateCardProps) {
  const noData = median === null || sampleSize === 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-muted-foreground">{title}</h3>
        {noData ? (
          <p className="text-base text-muted-foreground">Dati in arrivo</p>
        ) : (
          <>
            <p className="text-3xl sm:text-4xl font-bold tabular-nums">
              {median!.toFixed(4)} <span className="text-base font-normal text-muted-foreground">{unit}</span>
            </p>
            {spreadPct !== undefined && spreadPct !== null && (
              <p className={cn(
                "text-sm font-semibold tabular-nums",
                spreadPct >= 0 ? "text-rose-400" : "text-emerald-400",
              )}>
                {spreadPct >= 0 ? "+" : ""}{spreadPct.toFixed(1)}% vs wholesale
              </p>
            )}
            <div className="text-xs text-muted-foreground tabular-nums">
              p25 {p25?.toFixed(4) ?? "—"} · p75 {p75?.toFixed(4) ?? "—"} · {sampleSize} offerte
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Implement `components/mercato-libero/AggregateTrendChart.tsx`**

Client component con lightweight-charts, 4 serie sovrapposte.

```tsx
"use client";
import { useEffect, useRef } from "react";
import { createChart, LineSeries, type IChartApi, type Time } from "lightweight-charts";

export interface TrendSeries {
  slug: string;
  label: string;
  color: string;
  points: Array<{ date: string; value: number }>;
}

export function AggregateTrendChart({ series, unit }: { series: TrendSeries[]; unit: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const isDark = document.documentElement.classList.contains("dark");
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: { background: { color: "transparent" }, textColor: isDark ? "#e5e7eb" : "#1f2937" },
      grid: {
        vertLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
        horzLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
      },
      timeScale: { timeVisible: false, secondsVisible: false },
      localization: { priceFormatter: (v: number) => `${v.toFixed(4)} ${unit}` },
    });

    for (const s of series) {
      const line = chart.addSeries(LineSeries, { color: s.color, lineWidth: 2, title: s.label });
      line.setData(s.points.map((p) => ({
        time: Math.floor(new Date(p.date).getTime() / 1000) as Time,
        value: p.value,
      })));
    }
    chart.timeScale().fitContent();

    const onResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [series, unit]);

  return <div ref={containerRef} className="w-full" />;
}
```

**Step 3: Implement `app/[locale]/mercato-libero/page.tsx`**

```tsx
import { createServerClient } from "@/lib/supabase/server";
import { AGGREGATE_SLUGS, type AggregateSlug } from "@/lib/arera-aggregates";
import { AggregateCard } from "@/components/mercato-libero/AggregateCard";
import { AggregateTrendChart, type TrendSeries } from "@/components/mercato-libero/AggregateTrendChart";
import { CtaToEnergiapro } from "@/components/CtaToEnergiapro";
import { FaqSection } from "@/components/FaqSection";

const COLORS: Record<AggregateSlug, string> = {
  "mercato-libero-luce-fissa": "#14d97a",       // verde
  "mercato-libero-luce-variabile": "#10b981",   // verde scuro
  "mercato-libero-gas-fissa": "#f59e0b",        // arancio
  "mercato-libero-gas-variabile": "#fb923c",    // arancio chiaro
};

interface AggregateRow {
  aggregate_slug: string;
  computed_at: string;
  median: number;
  p25: number | null;
  p75: number | null;
  sample_size: number;
  unit: string;
}

export default async function MercatoLiberoPage() {
  const supabase = await createServerClient();

  // 1. Latest aggregato per ognuno dei 4 slug
  const slugs = AGGREGATE_SLUGS.map((a) => a.slug);
  const { data: latest } = await supabase
    .from("energy_index_aggregates")
    .select("aggregate_slug, computed_at, median, p25, p75, sample_size, unit")
    .in("aggregate_slug", slugs)
    .order("computed_at", { ascending: false });

  // Latest = primo row per ogni slug (sono ordinati DESC)
  const latestBySlug = new Map<string, AggregateRow>();
  for (const r of (latest ?? []) as AggregateRow[]) {
    if (!latestBySlug.has(r.aggregate_slug)) latestBySlug.set(r.aggregate_slug, r);
  }

  // 2. Trend ultimi 365 giorni
  const oneYearAgo = new Date();
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  const { data: trend } = await supabase
    .from("energy_index_aggregates")
    .select("aggregate_slug, computed_at, median")
    .in("aggregate_slug", slugs)
    .gte("computed_at", oneYearAgo.toISOString().slice(0, 10))
    .order("computed_at", { ascending: true });

  // Group trend by slug
  const trendBySlug = new Map<string, Array<{ date: string; value: number }>>();
  for (const r of (trend ?? []) as Array<{ aggregate_slug: string; computed_at: string; median: number }>) {
    const arr = trendBySlug.get(r.aggregate_slug) ?? [];
    arr.push({ date: String(r.computed_at), value: Number(r.median) });
    trendBySlug.set(r.aggregate_slug, arr);
  }

  // Series per il chart (luce e gas in chart separati per via dell'unit diversa)
  const electricSeries: TrendSeries[] = AGGREGATE_SLUGS
    .filter((a) => a.commodity === "electricity")
    .map((a) => ({
      slug: a.slug,
      label: a.displayShort,
      color: COLORS[a.slug],
      points: trendBySlug.get(a.slug) ?? [],
    }));
  const gasSeries: TrendSeries[] = AGGREGATE_SLUGS
    .filter((a) => a.commodity === "gas")
    .map((a) => ({
      slug: a.slug,
      label: a.displayShort,
      color: COLORS[a.slug],
      points: trendBySlug.get(a.slug) ?? [],
    }));

  return (
    <div className="container mx-auto px-4 py-8 space-y-10">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold">Mercato Libero</h1>
        <p className="text-muted-foreground">
          Osservatorio statistico delle offerte PLACET pubblicate dal Portale Offerte ARERA.
          I prezzi mostrati sono la mediana delle offerte attive con quartili p25 e p75.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {AGGREGATE_SLUGS.map((a) => {
          const row = latestBySlug.get(a.slug);
          return (
            <AggregateCard
              key={a.slug}
              title={a.displayName}
              median={row?.median ?? null}
              p25={row?.p25 ?? null}
              p75={row?.p75 ?? null}
              sampleSize={row?.sample_size ?? 0}
              unit={a.unit}
            />
          );
        })}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Trend mediana ultimi 12 mesi — Luce</h2>
        <AggregateTrendChart series={electricSeries} unit="€/kWh" />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Trend mediana ultimi 12 mesi — Gas</h2>
        <AggregateTrendChart series={gasSeries} unit="€/Smc" />
      </section>

      <FaqSection slug="mercato-libero" />

      <CtaToEnergiapro campaign="mercato-libero" />
    </div>
  );
}
```

**Step 4: Typecheck + build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -15
```
Expected: clean, success.

**Step 5: Commit**

```bash
git add app/[locale]/mercato-libero/page.tsx components/mercato-libero/AggregateCard.tsx components/mercato-libero/AggregateTrendChart.tsx
git commit -m "feat(mercato-libero): pagina con 4 aggregate card + trend chart luce+gas"
```

---

## Task 8 — Home banner `MarketBanner`

**Files:**
- Create: `components/home/MarketBanner.tsx`
- Modify: `app/[locale]/page.tsx`

**Step 1: Implement `components/home/MarketBanner.tsx`**

```tsx
import Link from "next/link";
import { ArrowRight, LineChart } from "lucide-react";

export interface MarketBannerProps {
  /** Mediana luce variabile (alpha), null se nessun dato. */
  luceVariabileMedian: number | null;
  /** Numero totale offerte oggi. */
  totalOffers: number;
}

export function MarketBanner({ luceVariabileMedian, totalOffers }: MarketBannerProps) {
  const hasData = luceVariabileMedian !== null && totalOffers > 0;
  return (
    <Link
      href="/it/mercato-libero"
      aria-label="Esplora le offerte del mercato libero"
      className="group relative block cursor-pointer overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <LineChart className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Mercato Libero</h2>
            {hasData ? (
              <p className="text-sm sm:text-base text-muted-foreground">
                Spread mediano luce variabile: <span className="font-semibold tabular-nums text-foreground">+{luceVariabileMedian!.toFixed(4)} €/kWh</span> · {totalOffers} offerte ARERA
              </p>
            ) : (
              <p className="text-sm sm:text-base text-muted-foreground">
                Esplora le offerte PLACET aggiornate ogni giorno
              </p>
            )}
          </div>
        </div>
        <ArrowRight aria-hidden="true" className="hidden sm:block h-6 w-6 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </div>
    </Link>
  );
}
```

**Step 2: Update `app/[locale]/page.tsx`**

Aggiungi import + fetch luce-var median + sample sum, render banner sotto il grid:

```tsx
import { MarketBanner } from "@/components/home/MarketBanner";

// Inside HomeIt() — dopo il [pun, psv] = await Promise.all(...):
async function getMarketBannerData(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  // Latest luce-variabile median
  const { data: latest } = await supabase
    .from("energy_index_aggregates")
    .select("median, sample_size, computed_at")
    .eq("aggregate_slug", "mercato-libero-luce-variabile")
    .order("computed_at", { ascending: false })
    .limit(1);

  // Total offers latest day (luce + gas)
  const { data: totals } = await supabase
    .from("energy_index_aggregates")
    .select("sample_size")
    .eq("computed_at", latest?.[0]?.computed_at ?? null);

  const total = (totals ?? []).reduce((s, r) => s + Number(r.sample_size ?? 0), 0);
  return {
    luceVariabileMedian: latest?.[0] ? Number(latest[0].median) : null,
    totalOffers: total,
  };
}

const [pun, psv, market] = await Promise.all([
  getLatestPair(supabase, "pun"),
  getLatestPair(supabase, "psv"),
  getMarketBannerData(supabase),
]);

// In the JSX, after the grid:
<MarketBanner
  luceVariabileMedian={market.luceVariabileMedian}
  totalOffers={market.totalOffers}
/>
```

**Step 3: Typecheck + build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -10
```

**Step 4: Commit**

```bash
git add components/home/MarketBanner.tsx 'app/[locale]/page.tsx'
git commit -m "feat(home-banner): MarketBanner full-width sotto le 2 card wholesale"
```

---

## Task 9 — FAQ mercato libero

**Files:**
- Create: `content/it/faq/mercato-libero.md`

**Step 1: Markdown**

```markdown
---
title: "Domande frequenti — Mercato Libero"
---

## Cos'è il mercato libero?

Dal 2024 in Italia il mercato dell'energia è completamente libero: ogni cliente sceglie tra le offerte dei venditori sul mercato libero (chi non sceglie viene assegnato al Servizio a Tutele Graduali, transitorio). Le offerte sono di due tipi: **prezzo fisso** (blocca il costo per 12/24 mesi) e **prezzo variabile** (segue un indice di mercato come il PUN o il PSV).

## Cosa sono le offerte PLACET?

PLACET = **P**rezzo **L**ibero **A** **C**ondizioni **E**quiparate di **T**utela. Sono offerte standard che ogni venditore deve esporre obbligatoriamente, semplici e comparabili: stessa struttura, stesse clausole, varia solo il prezzo. Buon riferimento per capire dove sta il mercato libero, anche se non sono necessariamente le offerte più convenienti — il venditore può proporre offerte commerciali "non PLACET" con prezzi e clausole personalizzate.

## Come scegliere tra prezzo fisso e variabile?

- **Prezzo fisso**: ideale se cerchi prevedibilità in bolletta o pensi che i prezzi salgano. Bloccare ora il costo €/kWh ti protegge dai rincari.
- **Prezzo variabile**: ideale se pensi che i prezzi caleranno o vuoi seguire il mercato. Lo "spread" (alpha) si somma al prezzo PUN/PSV dell'ora. Se il PUN scende, paghi meno; se sale, paghi di più.

Non c'è una scelta "giusta" in assoluto: dipende dall'avversione al rischio e dall'orizzonte. Confronta su [energiapro.biz](https://energiapro.biz) per simulazioni sul tuo consumo annuo.

## Da dove vengono i dati?

I dati sono scaricati ogni notte dal [Portale Offerte ARERA](https://www.ilportaleofferte.it), open data ex L. 190/2012 e D.Lgs. 33/2013. La fonte è autorevole e contiene tutte le offerte PLACET attive del mercato italiano.
```

**Step 2: Commit**

```bash
git add content/it/faq/mercato-libero.md
git commit -m "docs(faq-mercato-libero): 4 Q&A su mercato libero + PLACET + scelta fisso/variabile"
```

---

## Task 10 — Verify + merge + apply migration + deploy ETL + run backfill

### Step 1: Test suite

```bash
npx vitest run
```
Expected: 43 passed (38 + 5 new).

### Step 2: Build

```bash
npm run build 2>&1 | tail -10
```
Expected: success.

### Step 3: Push + merge in main

```bash
git push
# da repo root:
git -C /Users/semronzoni/Desktop/1RangerDea/Claude/EnergyIndex fetch origin
git -C /Users/semronzoni/Desktop/1RangerDea/Claude/EnergyIndex merge --no-ff claude/wizardly-mccarthy-556b3a -m "merge: Slice 4 — mercato libero ARERA (osservatorio statistico)"
git -C /Users/semronzoni/Desktop/1RangerDea/Claude/EnergyIndex push origin main
```

### Step 4: Apply migration UNIQUE constraint (controller via MCP)

`mcp__...__apply_migration` con il contenuto di Task 2.

### Step 5: Deploy edge function (controller via MCP)

`mcp__...__deploy_edge_function name=etl-arera-placet verify_jwt=false files=[etl-arera-placet/index.ts + _shared/etl-runner.ts + _shared/db.ts + _shared/parsers/arera-placet.ts + _shared/deno.json]`

### Step 6: Smoke ETL

```bash
curl -sS -X POST "https://epbluenhmdwgmgcewrsf.supabase.co/functions/v1/etl-arera-placet"
```
Expected: `{"ok":true,"run_id":...,"rows_ingested":...,"metadata":{"as_of":"...","aggregates":4}}`

### Step 7: Apply pg_cron schedule (controller via MCP execute_sql, with service-role JWT)

Come pattern PUN/PSV.

### Step 8: Run backfill (controller, background)

```bash
nohup npm run backfill:arera-placet > /tmp/arera-backfill.log 2>&1 &
```
ETA: ~8-15 min.

### Step 9: Smoke live

`https://energyindex.it/it/mercato-libero` → 4 card popolate, 2 chart pieni.
`https://energyindex.it/it` → banner "Mercato Libero" sotto le 2 card wholesale.

---

## Out of scope (Fase 2 / future slice)

- Pagina ticker `/it/mercato-libero/ticker` con tutte le offerte scorrevoli
- Filtri vendor/regione
- Schema MLIBERO XML (Mercato Libero non-PLACET)
- Simulazione su consumo annuo
- Spread vs reference automatico nelle card (richiede conversione PSV €/MWh ↔ €/Smc che merita un task dedicato)
