# Slice 7 — Driver di mercato Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** aggiungere 3 indici "driver" (Brent, CO2 EUA, Temperatura Italia) al sito energyindex.it come asset full-pattern (ETL daily, card home, pagine indice, SEO, FAQ).

**Architecture:** stack invariato (Next.js 16 + Supabase Postgres + GitHub Actions). Nessuna nuova tabella DB — riusa `assets` + `price_observations`. 3 nuovi ETL TypeScript schedulati come GitHub Actions, replicando il pattern dell'ETL ARERA esistente. RPC dedicata per il calcolo on-the-fly dell'anomalia termica stagionale (delta vs media 5 anni stesso giorno). Frontend: nuovo componente `DriverCard` per la home + branch nella pagina indice esistente per il caso temperatura.

**Tech Stack:** TypeScript, Next.js 16 file conventions, Supabase JS, GitHub Actions, Vitest. Fonti: EIA Open Data API, Meteostat API, Ember Climate JSON (fallback Investing scraping con cheerio).

**Design doc:** `docs/plans/2026-05-13-driver-di-mercato-design.md`

**Notazione comandi git in questo plan:**
Tutti gli `npm test`, `npx tsc --noEmit`, `npm run build` si eseguono nella root del worktree:
`/Users/semronzoni/Desktop/1RangerDea/Claude/EnergyIndex/.claude/worktrees/wizardly-mccarthy-556b3a`.

Tutti i `git commit` + `git push origin main` si eseguono dal clone `/tmp/eidx-slice7` (vedi Task 1 per setup). I file vengono prima scritti nel worktree, poi copiati al clone via `cp` prima di committare. Questo perché il `.git/` del Desktop ha xattr `com.apple.provenance` che blocca `git pack-objects` (vedi history di Slice 5 per dettagli).

**Auth git:** SSH deploy key configurata, alias `git@github-eidx:2appsrl/energyindex.git`. Niente PAT, niente prompt — push automatico.

---

## Task 0 — Setup ambiente di lavoro

**Files:**
- Modify: nessuno (solo setup local)

**Step 1: Crea il clone "push only" in /tmp**

Run:
```bash
rm -rf /tmp/eidx-slice7
git clone git@github-eidx:2appsrl/energyindex.git /tmp/eidx-slice7
cd /tmp/eidx-slice7
git remote -v
```

Expected:
```
origin  git@github-eidx:2appsrl/energyindex.git (fetch)
origin  git@github-eidx:2appsrl/energyindex.git (push)
```

**Step 2: Verifica branch main aggiornato**

```bash
git -C /tmp/eidx-slice7 log --oneline -3
```

Expected: l'ultimo commit è `8cca670 docs: design Slice 7 Driver di mercato` (oppure più recente se nel frattempo c'è stato altro).

**Step 3: Pulisce eventuali processi residui**

```bash
pkill -9 -f "git push" 2>/dev/null; pkill -9 -f "pack-objects" 2>/dev/null; sleep 1
```

Niente commit qui — è solo setup.

---

## Task 1 — Migration: 3 nuovi asset

**Files:**
- Create: `supabase/migrations/20260513000001_add_driver_assets.sql`

**Step 1: Crea il file migration**

`supabase/migrations/20260513000001_add_driver_assets.sql`:

```sql
-- Slice 7 Driver di mercato: 3 nuovi asset.
-- Convenzioni:
--   slug:           kebab-case URL-friendly
--   commodity:      categoria logica (oil, co2, temperature) per filtri
--   pricing_kind:   spot / settlement / observation (per indicare la natura del valore)

INSERT INTO assets (slug, display_name_it, unit, commodity, pricing_kind)
VALUES
  ('brent',          'Brent — Petrolio greggio',       '$/bbl',  'oil',         'spot'),
  ('co2',            'CO2 — Quota emissione EU ETS',   '€/tCO2', 'co2',         'settlement'),
  ('temperatura-it', 'Temperatura Italia (media naz.)', '°C',    'temperature', 'observation')
ON CONFLICT (slug) DO NOTHING;
```

**Step 2: Applica la migration via Supabase MCP**

Usa il tool `mcp__42edcf0e-514f-4173-b1a8-a59c2bb92d01__apply_migration` con `name: "add_driver_assets"` e il SQL sopra.

**Step 3: Verifica con SELECT**

```sql
SELECT slug, display_name_it, unit FROM assets
WHERE slug IN ('brent','co2','temperatura-it');
```

Expected: 3 righe ritornate.

**Step 4: Commit (nel /tmp/eidx-slice7)**

```bash
cp /Users/semronzoni/Desktop/1RangerDea/Claude/EnergyIndex/.claude/worktrees/wizardly-mccarthy-556b3a/supabase/migrations/20260513000001_add_driver_assets.sql /tmp/eidx-slice7/supabase/migrations/
cd /tmp/eidx-slice7
git add supabase/migrations/20260513000001_add_driver_assets.sql
git -c user.name="Sem Ronzoni" -c user.email="semronzoni.2app@gmail.com" \
  commit -m "feat(db): aggiungi assets brent, co2, temperatura-it"
git push origin main
```

---

## Task 2 — RPC `get_temperature_anomaly`

**Files:**
- Create: `supabase/migrations/20260513000002_rpc_temperature_anomaly.sql`

**Step 1: Scrivi la funzione SQL**

`supabase/migrations/20260513000002_rpc_temperature_anomaly.sql`:

```sql
-- Calcola anomalia termica stagionale: differenza fra il valore di p_date
-- e la media dei valori dello stesso giorno-mese negli ultimi 5 anni.
--
-- Esempio: p_date = 2026-05-13
--   value          = T del 2026-05-13
--   baseline_avg   = AVG(T del 2021-05-13, T del 2022-05-13, ... T del 2025-05-13)
--   anomaly        = value - baseline_avg
--   baseline_years = quanti anni effettivi sono entrati nella baseline (per UI fallback)
--
-- Se baseline_years < 3, il chiamante dovrebbe nascondere l'anomalia (dato troppo scarno).

CREATE OR REPLACE FUNCTION get_temperature_anomaly(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  value NUMERIC,
  baseline_avg NUMERIC,
  anomaly NUMERIC,
  baseline_years INT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH curr AS (
    SELECT po.value
    FROM price_observations po
    JOIN assets a ON a.id = po.asset_id
    WHERE a.slug = 'temperatura-it'
      AND DATE(po.observed_at) = p_date
    ORDER BY po.observed_at DESC
    LIMIT 1
  ),
  baseline AS (
    SELECT AVG(po.value) AS avg_value, COUNT(*) AS n
    FROM price_observations po
    JOIN assets a ON a.id = po.asset_id
    WHERE a.slug = 'temperatura-it'
      AND EXTRACT(MONTH FROM po.observed_at) = EXTRACT(MONTH FROM p_date)
      AND EXTRACT(DAY FROM po.observed_at) = EXTRACT(DAY FROM p_date)
      AND po.observed_at < p_date::timestamp
      AND po.observed_at >= (p_date - INTERVAL '5 years')::timestamp
  )
  SELECT
    c.value,
    b.avg_value,
    c.value - b.avg_value AS anomaly,
    b.n::int AS baseline_years
  FROM curr c, baseline b;
$$;

GRANT EXECUTE ON FUNCTION get_temperature_anomaly(DATE) TO anon, authenticated;
```

**Step 2: Apply via MCP**

`apply_migration` con `name: "rpc_temperature_anomaly"`.

**Step 3: Verifica firma**

```sql
SELECT * FROM get_temperature_anomaly(CURRENT_DATE);
```

Expected: 1 riga, tutti NULL (perché ancora nessun dato in `price_observations` per temperatura-it). Nessun errore.

**Step 4: Commit**

```bash
cp /Users/semronzoni/Desktop/.../supabase/migrations/20260513000002_rpc_temperature_anomaly.sql /tmp/eidx-slice7/supabase/migrations/
cd /tmp/eidx-slice7
git add supabase/migrations/20260513000002_rpc_temperature_anomaly.sql
git commit -m "feat(db): RPC get_temperature_anomaly per delta vs media 5 anni"
git push origin main
```

---

## Task 3 — BaseIngestor pattern

**Files:**
- Create: `scripts/lib/base-ingestor.ts`
- Create: `tests/scripts/base-ingestor.test.ts`

**Step 1: Test failing**

`tests/scripts/base-ingestor.test.ts`:

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";
import { BaseIngestor, type Observation } from "@/scripts/lib/base-ingestor";

class TestIngestor extends BaseIngestor {
  name = "test";
  assetSlug = "test-asset";
  async fetch() { return [{ date: "2026-05-13", value: 100 }]; }
  parse(raw: { date: string; value: number }[]): Observation[] {
    return raw.map((r) => ({
      observed_at: new Date(r.date + "T12:00:00Z"),
      value: r.value,
    }));
  }
}

describe("BaseIngestor", () => {
  it("run() invoca fetch+parse+upsert e ritorna conteggio righe", async () => {
    const ing = new TestIngestor();
    const upsertSpy = vi.spyOn(ing as unknown as { upsert: (...a: unknown[]) => Promise<number> }, "upsert")
      .mockResolvedValue(1);
    const res = await ing.run();
    expect(res.status).toBe("success");
    expect(res.rows).toBe(1);
    expect(upsertSpy).toHaveBeenCalledOnce();
  });

  it("run() cattura errori e li riporta nel result senza throw", async () => {
    class FailingIngestor extends BaseIngestor {
      name = "fail"; assetSlug = "test-asset";
      async fetch(): Promise<never> { throw new Error("boom"); }
      parse(): Observation[] { return []; }
    }
    const res = await new FailingIngestor().run();
    expect(res.status).toBe("error");
    expect(res.error).toContain("boom");
  });
});
```

**Step 2: Run test (FAIL — modulo non esiste)**

```bash
cd /Users/semronzoni/Desktop/1RangerDea/Claude/EnergyIndex/.claude/worktrees/wizardly-mccarthy-556b3a
npx vitest run tests/scripts/base-ingestor.test.ts
```

Expected: import error / module not found.

**Step 3: Implementa**

`scripts/lib/base-ingestor.ts`:

```ts
/**
 * Pattern base per script ETL daily.
 *
 * Subclassi implementano fetch() e parse(); BaseIngestor gestisce
 * upsert su price_observations e logging del run.
 *
 * Uso da CLI:
 *   const result = await new MyIngestor().run(startDate?, endDate?);
 *   process.exit(result.status === 'success' ? 0 : 1);
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Observation {
  observed_at: Date;
  value: number;
}

export interface RunResult {
  status: "success" | "error";
  rows: number;
  error?: string;
  startedAt: Date;
  finishedAt: Date;
}

export abstract class BaseIngestor {
  abstract name: string;
  abstract assetSlug: string;

  abstract fetch(start: Date, end: Date): Promise<unknown[]>;
  abstract parse(raw: unknown[]): Observation[];

  async run(start?: Date, end?: Date): Promise<RunResult> {
    const startedAt = new Date();
    const fromDate = start ?? this.yesterday();
    const toDate = end ?? new Date();
    try {
      console.log(`[${this.name}] fetch ${fromDate.toISOString().slice(0, 10)} → ${toDate.toISOString().slice(0, 10)}`);
      const raw = await this.fetch(fromDate, toDate);
      const parsed = this.parse(raw);
      console.log(`[${this.name}] parsed ${parsed.length} rows`);
      const rows = parsed.length > 0 ? await this.upsert(parsed) : 0;
      const finishedAt = new Date();
      console.log(`[${this.name}] upserted ${rows} rows in ${finishedAt.getTime() - startedAt.getTime()}ms`);
      return { status: "success", rows, startedAt, finishedAt };
    } catch (err) {
      const finishedAt = new Date();
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${this.name}] ERROR:`, message);
      return { status: "error", rows: 0, error: message, startedAt, finishedAt };
    }
  }

  protected async upsert(rows: Observation[]): Promise<number> {
    const supabase = this.supabase();
    // Lookup asset_id by slug
    const { data: asset, error: assetErr } = await supabase
      .from("assets")
      .select("id")
      .eq("slug", this.assetSlug)
      .maybeSingle();
    if (assetErr || !asset) {
      throw new Error(`asset slug '${this.assetSlug}' non trovato`);
    }
    const records = rows.map((r) => ({
      asset_id: asset.id,
      observed_at: r.observed_at.toISOString(),
      value: r.value,
    }));
    const { error: upErr, count } = await supabase
      .from("price_observations")
      .upsert(records, { onConflict: "asset_id,observed_at", count: "exact" });
    if (upErr) throw new Error(`upsert error: ${upErr.message}`);
    return count ?? records.length;
  }

  protected supabase(): SupabaseClient {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devono essere set");
    }
    return createClient(url, key, { auth: { persistSession: false } });
  }

  protected yesterday(): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d;
  }
}
```

**Step 4: Run tests (PASS)**

```bash
npx vitest run tests/scripts/base-ingestor.test.ts
```

Expected: 2 passed.

**Step 5: Commit**

```bash
cp .../scripts/lib/base-ingestor.ts /tmp/eidx-slice7/scripts/lib/base-ingestor.ts
cp .../tests/scripts/base-ingestor.test.ts /tmp/eidx-slice7/tests/scripts/base-ingestor.test.ts
cd /tmp/eidx-slice7
mkdir -p scripts/lib tests/scripts
git add scripts/lib/base-ingestor.ts tests/scripts/base-ingestor.test.ts
git commit -m "feat(etl): BaseIngestor pattern condiviso (fetch/parse/upsert + logging)"
git push origin main
```

---

## Task 4 — Brent ETL (EIA API)

**Files:**
- Create: `scripts/etl-brent.ts`
- Create: `scripts/backfill-brent.ts`
- Create: `tests/scripts/etl-brent.test.ts`
- Create: `tests/fixtures/eia-brent.json`
- Create: `.github/workflows/etl-brent-daily.yml`

**Step 1: Fixture response EIA**

`tests/fixtures/eia-brent.json`:

```json
{
  "response": {
    "data": [
      { "period": "2026-05-12", "value": "68.42" },
      { "period": "2026-05-13", "value": "69.10" }
    ]
  }
}
```

**Step 2: Test failing**

`tests/scripts/etl-brent.test.ts`:

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { BrentIngestor } from "@/scripts/etl-brent";
import fixture from "../fixtures/eia-brent.json";

describe("BrentIngestor.parse", () => {
  it("converte response EIA in Observation[] con date a mezzogiorno UTC", () => {
    const ing = new BrentIngestor();
    const parsed = ing.parse(fixture.response.data);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].observed_at.toISOString()).toBe("2026-05-12T12:00:00.000Z");
    expect(parsed[0].value).toBe(68.42);
    expect(parsed[1].value).toBe(69.10);
  });

  it("salta righe con value nullo o invalido", () => {
    const ing = new BrentIngestor();
    const parsed = ing.parse([
      { period: "2026-05-12", value: "68.42" },
      { period: "2026-05-13", value: null },
      { period: "2026-05-14", value: "abc" },
    ]);
    expect(parsed).toHaveLength(1);
  });
});
```

**Step 3: Implementa script**

`scripts/etl-brent.ts`:

```ts
/**
 * ETL Brent — EIA Open Data API v2 series PET.RBRTE.D.
 *
 * Esecuzione:
 *   - Daily da GitHub Actions (.github/workflows/etl-brent-daily.yml)
 *   - Manuale: npx tsx scripts/etl-brent.ts [--start=YYYY-MM-DD] [--end=YYYY-MM-DD]
 *
 * Env vars richieste:
 *   EIA_API_KEY                (registrazione: https://www.eia.gov/opendata/register.php)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { BaseIngestor, type Observation } from "./lib/base-ingestor";

interface EiaRow {
  period: string;
  value: string | null;
}

export class BrentIngestor extends BaseIngestor {
  name = "brent";
  assetSlug = "brent";

  async fetch(start: Date, end: Date): Promise<EiaRow[]> {
    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey) throw new Error("EIA_API_KEY mancante");
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const url = `https://api.eia.gov/v2/seriesid/PET.RBRTE.D?api_key=${apiKey}&start=${startStr}&end=${endStr}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`EIA API ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { response: { data: EiaRow[] } };
    return json.response.data;
  }

  parse(raw: EiaRow[]): Observation[] {
    const out: Observation[] = [];
    for (const row of raw) {
      if (row.value === null || row.value === undefined) continue;
      const num = Number(row.value);
      if (!Number.isFinite(num)) continue;
      out.push({
        observed_at: new Date(`${row.period}T12:00:00Z`),
        value: num,
      });
    }
    return out;
  }
}

// CLI entry
if (require.main === module) {
  void (async () => {
    const result = await new BrentIngestor().run();
    process.exit(result.status === "success" ? 0 : 1);
  })();
}
```

**Step 4: Backfill script**

`scripts/backfill-brent.ts`:

```ts
/**
 * Backfill Brent: scarica 10 anni indietro dall'API EIA.
 * Esecuzione manuale 1 sola volta dopo il primo deploy.
 *
 *   npx tsx scripts/backfill-brent.ts
 */
import { BrentIngestor } from "./etl-brent";

void (async () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 10);
  console.log(`Backfill Brent: ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`);
  const result = await new BrentIngestor().run(start, end);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "success" ? 0 : 1);
})();
```

**Step 5: GitHub Actions workflow**

`.github/workflows/etl-brent-daily.yml`:

```yaml
name: ETL Brent (daily)

on:
  schedule:
    - cron: "30 13 * * 1-5"  # 13:30 UTC = 15:30 IT (mar-sab perche' US chiude D-1)
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - name: Run ETL
        env:
          EIA_API_KEY: ${{ secrets.EIA_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: npx tsx scripts/etl-brent.ts
```

**Step 6: Run tests (PASS)**

```bash
npx vitest run tests/scripts/etl-brent.test.ts
```

Expected: 2 passed.

**Step 7: Commit**

```bash
# Copia i 5 file nel clone
for f in scripts/etl-brent.ts scripts/backfill-brent.ts tests/scripts/etl-brent.test.ts tests/fixtures/eia-brent.json .github/workflows/etl-brent-daily.yml; do
  mkdir -p "/tmp/eidx-slice7/$(dirname "$f")"
  cp "/Users/semronzoni/Desktop/.../$f" "/tmp/eidx-slice7/$f"
done
cd /tmp/eidx-slice7
git add scripts/etl-brent.ts scripts/backfill-brent.ts tests/scripts/etl-brent.test.ts tests/fixtures/eia-brent.json .github/workflows/etl-brent-daily.yml
git commit -m "feat(etl): Brent daily via EIA Open Data API + backfill 10y + GH Actions workflow"
git push origin main
```

---

## Task 5 — CO2 ETL (Ember Climate con fallback Investing scraping)

**Files:**
- Create: `scripts/etl-co2.ts`
- Create: `scripts/backfill-co2.ts`
- Create: `tests/scripts/etl-co2.test.ts`
- Create: `tests/fixtures/ember-co2.json`
- Create: `tests/fixtures/investing-co2.html`
- Create: `.github/workflows/etl-co2-daily.yml`
- Modify: `package.json` (aggiungi `cheerio` come dipendenza runtime)

**Step 1: Install cheerio**

Run nel worktree:
```bash
npm install cheerio
```
Expected: package.json + package-lock.json modificati.

**Step 2: Fixture Ember + Investing**

`tests/fixtures/ember-co2.json`:
```json
{
  "data": [
    { "date": "2026-05-12", "price_eur": 75.30, "instrument": "EUA Dec-26" },
    { "date": "2026-05-13", "price_eur": 76.10, "instrument": "EUA Dec-26" }
  ]
}
```

`tests/fixtures/investing-co2.html` (HTML pattern minimal estratto da Investing):
```html
<html><body>
<table id="curr_table">
  <thead><tr><th>Date</th><th>Price</th></tr></thead>
  <tbody>
    <tr><td>May 12, 2026</td><td>75.30</td></tr>
    <tr><td>May 13, 2026</td><td>76.10</td></tr>
  </tbody>
</table>
</body></html>
```

**Step 3: Test failing**

`tests/scripts/etl-co2.test.ts`:

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { Co2Ingestor, parseEmber, parseInvesting } from "@/scripts/etl-co2";
import emberFixture from "../fixtures/ember-co2.json";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Co2Ingestor parsers", () => {
  it("parseEmber estrae date e price_eur", () => {
    const out = parseEmber(emberFixture.data);
    expect(out).toHaveLength(2);
    expect(out[0].observed_at.toISOString().slice(0, 10)).toBe("2026-05-12");
    expect(out[0].value).toBe(75.30);
  });

  it("parseInvesting estrae le righe da HTML investing-style", () => {
    const html = readFileSync(resolve(__dirname, "../fixtures/investing-co2.html"), "utf-8");
    const out = parseInvesting(html);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0].value).toBe(75.30);
  });
});

describe("Co2Ingestor.parse (entry-point)", () => {
  it("delega a parseEmber se il raw e' { data: [...] }", () => {
    const ing = new Co2Ingestor();
    const parsed = ing.parse(emberFixture);
    expect(parsed).toHaveLength(2);
  });
});
```

**Step 4: Implementa script**

`scripts/etl-co2.ts`:

```ts
/**
 * ETL CO2 EUA — strategia a cascata:
 *   1) Ember Climate JSON endpoint
 *   2) Investing.com scraping (fallback)
 *
 * NB: l'endpoint Ember va verificato all'esecuzione; al momento di scrittura
 * non c'e' un endpoint pubblico ufficiale, ma l'organizzazione pubblica i dati
 * via repository GitHub e potenzialmente JSON. Se non disponibile, fallback su
 * Investing scraping che e' affidabile ma fragile a redesign HTML.
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import * as cheerio from "cheerio";
import { BaseIngestor, type Observation } from "./lib/base-ingestor";

interface EmberRow { date: string; price_eur: number; instrument?: string }

export function parseEmber(rows: EmberRow[]): Observation[] {
  return rows
    .filter((r) => Number.isFinite(r.price_eur))
    .map((r) => ({
      observed_at: new Date(`${r.date}T12:00:00Z`),
      value: Number(r.price_eur),
    }));
}

export function parseInvesting(html: string): Observation[] {
  const $ = cheerio.load(html);
  const out: Observation[] = [];
  $("table#curr_table tbody tr, table tbody tr").each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length < 2) return;
    const dateStr = $(tds[0]).text().trim();
    const priceStr = $(tds[1]).text().replace(/[, ]/g, ".").trim();
    const date = new Date(dateStr);
    const price = Number(priceStr);
    if (!Number.isFinite(date.getTime()) || !Number.isFinite(price)) return;
    out.push({
      observed_at: new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12)),
      value: price,
    });
  });
  return out;
}

export class Co2Ingestor extends BaseIngestor {
  name = "co2";
  assetSlug = "co2";

  async fetch(): Promise<unknown> {
    // Strategy 1: Ember Climate
    try {
      const res = await fetch("https://ember-climate.org/api/carbon-price/eua-daily");
      if (res.ok) {
        return await res.json();
      }
    } catch { /* fallthrough */ }
    // Strategy 2: Investing scraping
    const res = await fetch(
      "https://www.investing.com/commodities/carbon-emissions-historical-data",
      { headers: { "user-agent": "Mozilla/5.0 EnergyIndex Bot" } },
    );
    if (!res.ok) throw new Error(`Investing fallback HTTP ${res.status}`);
    return await res.text();
  }

  parse(raw: unknown): Observation[] {
    if (typeof raw === "string") return parseInvesting(raw);
    if (typeof raw === "object" && raw !== null && "data" in raw) {
      return parseEmber((raw as { data: EmberRow[] }).data);
    }
    return [];
  }
}

if (require.main === module) {
  void (async () => {
    const result = await new Co2Ingestor().run();
    process.exit(result.status === "success" ? 0 : 1);
  })();
}
```

**Step 5: Backfill**

`scripts/backfill-co2.ts`:

```ts
import { Co2Ingestor } from "./etl-co2";

void (async () => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 5);
  console.log(`Backfill CO2: ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`);
  const result = await new Co2Ingestor().run(start, end);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "success" ? 0 : 1);
})();
```

**Step 6: Workflow**

`.github/workflows/etl-co2-daily.yml`:

```yaml
name: ETL CO2 (daily)

on:
  schedule:
    - cron: "0 18 * * 1-5"  # 18:00 UTC = 19:00 CET (settlement ICE/EEX)
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm" }
      - run: npm ci
      - name: Run ETL
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: npx tsx scripts/etl-co2.ts
```

**Step 7: Run tests**

```bash
npx vitest run tests/scripts/etl-co2.test.ts
```

Expected: 3 passed.

**Step 8: Commit**

```bash
# Copia 6 file + package.json/package-lock.json
for f in scripts/etl-co2.ts scripts/backfill-co2.ts tests/scripts/etl-co2.test.ts tests/fixtures/ember-co2.json tests/fixtures/investing-co2.html .github/workflows/etl-co2-daily.yml package.json package-lock.json; do
  mkdir -p "/tmp/eidx-slice7/$(dirname "$f")"
  cp "/Users/.../$f" "/tmp/eidx-slice7/$f"
done
cd /tmp/eidx-slice7
git add scripts/etl-co2.ts scripts/backfill-co2.ts tests/scripts/etl-co2.test.ts tests/fixtures/ember-co2.json tests/fixtures/investing-co2.html .github/workflows/etl-co2-daily.yml package.json package-lock.json
git commit -m "feat(etl): CO2 EUA daily via Ember + fallback Investing scraping (cheerio)"
git push origin main
```

---

## Task 6 — Temperatura Italia ETL (Open-Meteo)

**Files:**
- Create: `scripts/etl-temperatura.ts`
- Create: `scripts/backfill-temperatura.ts`
- Create: `tests/scripts/etl-temperatura.test.ts`
- Create: `tests/fixtures/open-meteo-milano.json`
- Create: `.github/workflows/etl-temperatura-daily.yml`

**Step 1: API e disponibilità**

Open-Meteo NON richiede API key. Verifica volo che l'endpoint funzioni:

```bash
curl -s "https://archive-api.open-meteo.com/v1/archive?latitude=45.4642&longitude=9.19&start_date=2026-05-10&end_date=2026-05-13&daily=temperature_2m_mean&timezone=Europe/Rome" | jq '.daily'
```

Expected: oggetto `{ time: [...], temperature_2m_mean: [...] }` con 4 valori.

**Step 2: Fixture**

`tests/fixtures/open-meteo-milano.json`:

```json
{
  "latitude": 45.4642,
  "longitude": 9.19,
  "daily": {
    "time": ["2026-05-12", "2026-05-13"],
    "temperature_2m_mean": [18.3, 19.1]
  }
}
```

**Step 3: Test failing**

`tests/scripts/etl-temperatura.test.ts`:

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { TemperaturaIngestor, weightedAverage, CITIES } from "@/scripts/etl-temperatura";

describe("TemperaturaIngestor", () => {
  it("pesi delle citta' sommano a 1.00 (entro 0.001)", () => {
    const sum = CITIES.reduce((acc, c) => acc + c.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.001);
  });

  it("weightedAverage calcola media pesata", () => {
    const result = weightedAverage([
      { weight: 0.5, value: 10 },
      { weight: 0.5, value: 20 },
    ]);
    expect(result).toBe(15);
  });

  it("weightedAverage gestisce array vuoto ritornando null", () => {
    expect(weightedAverage([])).toBeNull();
  });

  it("parse aggrega per data le risposte multi-citta'", () => {
    const ing = new TemperaturaIngestor();
    // Mock data: 2 citta', 2 giorni
    const raw = [
      { city: "milano", weight: 0.5, rows: [
        { date: "2026-05-12", tavg: 18 },
        { date: "2026-05-13", tavg: 20 },
      ]},
      { city: "roma", weight: 0.5, rows: [
        { date: "2026-05-12", tavg: 22 },
        { date: "2026-05-13", tavg: 24 },
      ]},
    ];
    const parsed = ing.parse(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].value).toBe(20); // (18*0.5 + 22*0.5)
    expect(parsed[1].value).toBe(22); // (20*0.5 + 24*0.5)
  });
});
```

**Step 4: Implementa**

`scripts/etl-temperatura.ts`:

```ts
/**
 * ETL Temperatura Italia — Open-Meteo API (ERA5 reanalysis + forecast).
 *
 * Scarica T media giornaliera da 9 coordinate (citta' principali italiane),
 * calcola la media nazionale ponderata per popolazione, e la salva come asset
 * "temperatura-it".
 *
 * Open-Meteo NON richiede API key per uso non-commerciale; il sito cita la
 * fonte in footer/JSON-LD (CC-BY 4.0).
 *
 * Endpoint storici (passato): archive-api.open-meteo.com/v1/archive
 * Endpoint recenti (oggi, ieri): api.open-meteo.com/v1/forecast (past_days=N)
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { BaseIngestor, type Observation } from "./lib/base-ingestor";

export interface City {
  name: string;
  lat: number;
  lon: number;
  weight: number;
}

// Pesi: somma 1.00 (9 citta' = ~50% popolazione Italia, ma rappresentative
// per macro-zone climatiche).
export const CITIES: City[] = [
  { name: "milano",  lat: 45.4642, lon:  9.1900, weight: 0.20 },
  { name: "roma",    lat: 41.9028, lon: 12.4964, weight: 0.18 },
  { name: "napoli",  lat: 40.8518, lon: 14.2681, weight: 0.12 },
  { name: "torino",  lat: 45.0703, lon:  7.6869, weight: 0.10 },
  { name: "bologna", lat: 44.4949, lon: 11.3426, weight: 0.08 },
  { name: "firenze", lat: 43.7696, lon: 11.2558, weight: 0.07 },
  { name: "bari",    lat: 41.1171, lon: 16.8719, weight: 0.08 },
  { name: "palermo", lat: 38.1157, lon: 13.3615, weight: 0.10 },
  { name: "verona",  lat: 45.4384, lon: 10.9916, weight: 0.07 },
];

export function weightedAverage(items: { weight: number; value: number }[]): number | null {
  if (items.length === 0) return null;
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const sum = items.reduce((s, i) => s + i.value * i.weight, 0);
  return sum / totalWeight;
}

interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_mean: (number | null)[];
  };
}

interface CityRaw {
  city: string;
  weight: number;
  rows: { date: string; tavg: number | null }[];
}

export class TemperaturaIngestor extends BaseIngestor {
  name = "temperatura";
  assetSlug = "temperatura-it";

  async fetch(start: Date, end: Date): Promise<CityRaw[]> {
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    // Open-Meteo archive ha dati con qualche giorno di delay. Per coprire anche
    // oggi/ieri (forecast endpoint) split: se end e' negli ultimi 5 giorni, usa
    // forecast con past_days; altrimenti usa archive.
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setUTCDate(fiveDaysAgo.getUTCDate() - 5);
    const useForecast = end >= fiveDaysAgo;

    const out: CityRaw[] = [];
    for (const city of CITIES) {
      const url = useForecast
        ? `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_mean&timezone=Europe%2FRome&past_days=7`
        : `https://archive-api.open-meteo.com/v1/archive?latitude=${city.lat}&longitude=${city.lon}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_mean&timezone=Europe%2FRome`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo ${city.name} HTTP ${res.status}`);
      const json = (await res.json()) as OpenMeteoResponse;
      const rows: { date: string; tavg: number | null }[] = [];
      for (let i = 0; i < json.daily.time.length; i++) {
        rows.push({
          date: json.daily.time[i],
          tavg: json.daily.temperature_2m_mean[i],
        });
      }
      out.push({ city: city.name, weight: city.weight, rows });
      // Rate limit conservativo: max 600 chiamate/min (Open-Meteo limit) → 100ms tra una e l'altra basta
      await new Promise((r) => setTimeout(r, 150));
    }
    return out;
  }

  parse(raw: CityRaw[]): Observation[] {
    // Aggrega per data
    const byDate = new Map<string, { weight: number; value: number }[]>();
    for (const c of raw) {
      for (const row of c.rows) {
        if (row.tavg === null || !Number.isFinite(row.tavg)) continue;
        const list = byDate.get(row.date) ?? [];
        list.push({ weight: c.weight, value: row.tavg });
        byDate.set(row.date, list);
      }
    }
    const out: Observation[] = [];
    for (const [date, items] of byDate) {
      const avg = weightedAverage(items);
      if (avg === null) continue;
      out.push({
        observed_at: new Date(`${date}T12:00:00Z`),
        value: Math.round(avg * 100) / 100, // 2 decimali
      });
    }
    return out.sort((a, b) => a.observed_at.getTime() - b.observed_at.getTime());
  }
}

if (require.main === module) {
  void (async () => {
    const result = await new TemperaturaIngestor().run();
    process.exit(result.status === "success" ? 0 : 1);
  })();
}
```

**Step 5: Backfill** (con chunking di 1 anno alla volta)

`scripts/backfill-temperatura.ts`:

```ts
/**
 * Backfill Temperatura 5 anni con chunking annuale.
 * Open-Meteo archive accetta range estesi ma chunking riduce risposta JSON
 * a dimensioni gestibili e da' miglior progress feedback.
 */
import { TemperaturaIngestor } from "./etl-temperatura";

void (async () => {
  const ing = new TemperaturaIngestor();
  const today = new Date();
  for (let yearsAgo = 5; yearsAgo >= 1; yearsAgo--) {
    const start = new Date(today);
    start.setUTCFullYear(start.getUTCFullYear() - yearsAgo);
    const end = new Date(today);
    end.setUTCFullYear(end.getUTCFullYear() - yearsAgo + 1);
    if (end > today) end.setTime(today.getTime());
    console.log(`Chunk ${yearsAgo}y: ${start.toISOString().slice(0,10)} → ${end.toISOString().slice(0,10)}`);
    const r = await ing.run(start, end);
    console.log(JSON.stringify(r, null, 2));
    if (r.status === "error") process.exit(1);
  }
})();
```

**Step 6: Workflow**

`.github/workflows/etl-temperatura-daily.yml`:

```yaml
name: ETL Temperatura (daily)

on:
  schedule:
    - cron: "0 7 * * *"  # 07:00 UTC = 09:00 IT
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm" }
      - run: npm ci
      - name: Run ETL
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: npx tsx scripts/etl-temperatura.ts
```

(Open-Meteo non richiede API key, quindi non servono secret per la fonte meteo.)

**Step 7: Run tests + commit**

```bash
npx vitest run tests/scripts/etl-temperatura.test.ts
```

Expected: 4 passed.

```bash
for f in scripts/etl-temperatura.ts scripts/backfill-temperatura.ts tests/scripts/etl-temperatura.test.ts tests/fixtures/open-meteo-milano.json .github/workflows/etl-temperatura-daily.yml; do
  mkdir -p "/tmp/eidx-slice7/$(dirname "$f")"; cp "..."/$f /tmp/eidx-slice7/$f
done
cd /tmp/eidx-slice7
git add scripts/etl-temperatura.ts scripts/backfill-temperatura.ts tests/scripts/etl-temperatura.test.ts tests/fixtures/open-meteo-milano.json .github/workflows/etl-temperatura-daily.yml
git commit -m "feat(etl): Temperatura Italia daily via Open-Meteo (9 citta', media ponderata)"
git push origin main
```

---

## Task 7 — Componente DriverCard

**Files:**
- Create: `components/home/DriverCard.tsx`
- Create: `tests/components/DriverCard.test.tsx`

**Step 1: Test failing**

`tests/components/DriverCard.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DriverCard } from "@/components/home/DriverCard";
import { Droplets } from "lucide-react";

describe("DriverCard", () => {
  it("mostra titolo, unita' e valore", () => {
    render(
      <DriverCard
        href="/it/indice/brent"
        icon={Droplets}
        title="Brent"
        subtitle="Petrolio greggio"
        value={68.42}
        prevValue={67.88}
        unit="$/bbl"
      />,
    );
    expect(screen.getByText("Brent")).toBeInTheDocument();
    expect(screen.getByText(/68/)).toBeInTheDocument();
    expect(screen.getByText(/\$\/bbl/)).toBeInTheDocument();
  });

  it("mostra anomalia stagionale invece di % quando passata", () => {
    render(
      <DriverCard
        href="/it/indice/temperatura"
        icon={Droplets}
        title="Temperatura Italia"
        subtitle="Anomalia stagionale"
        value={19.5}
        unit="°C"
        anomaly={2.3}
        baselineLabel="vs media 2021-2025"
      />,
    );
    expect(screen.getByText(/\+2,3\s*°C/)).toBeInTheDocument();
    expect(screen.getByText(/vs media 2021-2025/)).toBeInTheDocument();
  });

  it("mostra 'Dati in arrivo' quando value e' null", () => {
    render(
      <DriverCard
        href="/it/indice/brent"
        icon={Droplets}
        title="Brent"
        subtitle="Petrolio"
        value={null}
        prevValue={null}
        unit="$/bbl"
      />,
    );
    expect(screen.getByText(/Dati in arrivo/i)).toBeInTheDocument();
  });
});
```

NB: serve `@testing-library/react` come dev dependency. Se non c'è, installalo:
```bash
npm install -D @testing-library/react @testing-library/jest-dom
```

**Step 2: Implementa**

`components/home/DriverCard.tsx`:

```tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercentDelta } from "@/lib/format";

const itNumber = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const itSigned = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

export interface DriverCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  value: number | null;
  prevValue?: number | null;
  unit: string;
  /** Se passato, sostituisce il delta % con un'anomalia signed in unita' base
   *  (es. 2.3 -> "+2,3 °C"). */
  anomaly?: number | null;
  /** Label esplicativa sotto l'anomalia, es. "vs media 2021-2025". */
  baselineLabel?: string;
}

export function DriverCard({
  href, icon: Icon, title, subtitle, value, prevValue, unit, anomaly, baselineLabel,
}: DriverCardProps) {
  const usingAnomaly = anomaly !== undefined && anomaly !== null;
  const deltaPct = !usingAnomaly && value !== null && prevValue !== null && prevValue !== undefined
    ? formatPercentDelta(value, prevValue)
    : null;
  const isUp = usingAnomaly ? anomaly! >= 0
    : value !== null && prevValue !== null && prevValue !== undefined && value >= prevValue;

  return (
    <Link
      href={href}
      className="group relative block cursor-pointer overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {(deltaPct || usingAnomaly) && (
          <span className={cn(
            "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
            isUp ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
          )}>
            {usingAnomaly
              ? `${itSigned.format(anomaly!)} ${unit}`
              : deltaPct}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-0.5">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="mt-2">
        {value !== null ? (
          <div className="text-2xl sm:text-3xl font-bold tabular-nums">
            {itNumber.format(value)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Dati in arrivo</div>
        )}
        {usingAnomaly && baselineLabel && (
          <div className="text-xs text-muted-foreground mt-0.5">{baselineLabel}</div>
        )}
      </div>
    </Link>
  );
}
```

**Step 3: Run tests, commit**

```bash
npx vitest run tests/components/DriverCard.test.tsx
```

Expected: 3 passed.

```bash
cp components/home/DriverCard.tsx /tmp/eidx-slice7/components/home/
cp tests/components/DriverCard.test.tsx /tmp/eidx-slice7/tests/components/
cd /tmp/eidx-slice7
mkdir -p tests/components
git add components/home/DriverCard.tsx tests/components/DriverCard.test.tsx package.json package-lock.json
git commit -m "feat(home): componente DriverCard (card piccola per Brent/CO2/Temperatura)"
git push origin main
```

---

## Task 8 — Home update con sezione "Driver di mercato"

**Files:**
- Modify: `app/[locale]/page.tsx`

**Step 1: Aggiungi data fetch per i 3 nuovi asset**

Nel file `app/[locale]/page.tsx`, dopo la funzione `getMarketBannerData`, aggiungi:

```ts
async function getDriverLatest(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  slug: string,
): Promise<{ value: number | null; prevValue: number | null; unit: string }> {
  // Identico a getLatestPair: ritorna ultimo valore e penultimo per delta %.
  return getLatestPair(supabase, slug);
}

async function getTemperatureAnomaly(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<{ value: number | null; anomaly: number | null; baseline_years: number }> {
  const { data } = await supabase.rpc("get_temperature_anomaly");
  const row = Array.isArray(data) ? data[0] : null;
  return {
    value: row?.value ?? null,
    anomaly: row?.anomaly ?? null,
    baseline_years: row?.baseline_years ?? 0,
  };
}
```

**Step 2: Estendi `HomeIt` per caricare i nuovi dati in parallelo**

Trova `const [pun, psv, market] = await Promise.all(...)` e cambialo a:

```ts
const [pun, psv, market, brent, co2, tempAnom] = await Promise.all([
  getLatestPair(supabase, "pun"),
  getLatestPair(supabase, "psv"),
  getMarketBannerData(supabase),
  getDriverLatest(supabase, "brent"),
  getDriverLatest(supabase, "co2"),
  getTemperatureAnomaly(supabase),
]);
```

**Step 3: Aggiungi la sezione JSX**

Tra il `</div>` che chiude la grid PUN/PSV e il `<MarketBanner .../>`, inserisci:

```tsx
<section className="space-y-4">
  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight border-l-4 border-primary pl-3">
    Driver di mercato
  </h2>
  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
    <DriverCard
      href="/it/indice/brent"
      icon={Droplets}
      title="Brent"
      subtitle="Petrolio greggio"
      value={brent.value}
      prevValue={brent.prevValue}
      unit="$/bbl"
    />
    <DriverCard
      href="/it/indice/co2"
      icon={Leaf}
      title="CO2 EUA"
      subtitle="Quota emissione EU ETS"
      value={co2.value}
      prevValue={co2.prevValue}
      unit="€/tCO2"
    />
    <DriverCard
      href="/it/indice/temperatura"
      icon={Thermometer}
      title="Temperatura Italia"
      subtitle="Anomalia stagionale"
      value={tempAnom.value}
      unit="°C"
      anomaly={tempAnom.baseline_years >= 3 ? tempAnom.anomaly : null}
      baselineLabel="vs media 5 anni"
    />
  </div>
</section>
```

E aggiorna gli imports in cima al file:

```ts
import { DriverCard } from "@/components/home/DriverCard";
import { Droplets, Leaf, Thermometer } from "lucide-react";
```

**Step 4: Typecheck + build**

```bash
cd /Users/...
npx tsc --noEmit
npm run build 2>&1 | tail -20
```

Expected: clean tsc, build verde.

**Step 5: Commit**

```bash
cp "app/[locale]/page.tsx" "/tmp/eidx-slice7/app/[locale]/page.tsx"
cd /tmp/eidx-slice7
git add "app/[locale]/page.tsx"
git commit -m "feat(home): sezione Driver di mercato (Brent + CO2 + Temperatura anomalia)"
git push origin main
```

---

## Task 9 — Estendere pagina `/it/indice/[slug]` per i 3 nuovi asset

**Files:**
- Modify: `app/[locale]/indice/[slug]/page.tsx`

**Step 1: Allarga `SUPPORTED_SLUGS` + mapping**

In cima al file `app/[locale]/indice/[slug]/page.tsx`:

```ts
const SUPPORTED_SLUGS = ["pun", "psv", "brent", "co2", "temperatura"] as const;

// URL slug -> DB asset slug (alias per URL puliti)
const URL_TO_ASSET_SLUG: Record<string, string> = {
  temperatura: "temperatura-it",
};

const SLUG_DESCRIPTIONS: Record<string, string> = {
  pun: "Prezzo Unico Nazionale del mercato elettrico italiano. Asta MGP del giorno prima, esiti pubblicati intorno alle 12:30.",
  psv: "Punto di Scambio Virtuale, riferimento all'ingrosso del gas naturale italiano. Asta MGP-GAS, esiti pubblicati intorno alle 17:00.",
  brent: "Prezzo benchmark del petrolio crude oil europeo (North Sea), riferimento globale. Driver storico di gas e elettrico.",
  co2: "Quota di emissione CO2 nell'EU Emissions Trading System. Costo che si scarica sui produttori termoelettrici e indirettamente sulla bolletta.",
  temperatura: "Temperatura media nazionale italiana, media pesata di 9 stazioni meteo per popolazione. Driver dei consumi di gas (riscaldamento) e elettrico (raffrescamento).",
};

const SOURCE_GRANULARITY_BY_SLUG: Record<string, "hourly" | "daily"> = {
  pun: "hourly",
  psv: "daily",
  brent: "daily",
  co2: "daily",
  temperatura: "daily",
};
```

**Step 2: Risolvi alias URL → DB**

Subito dopo `await params/searchParams`, modifica:

```ts
const effectiveSlug = URL_TO_ASSET_SLUG[slug] ?? slug;
// (il codice esistente per il branch PUN-zone resta dopo, basato su `slug` raw)
const zone = slug === "pun" ? resolveZone(zoneParam) : null;
const finalAssetSlug = zone ? zone.slug : effectiveSlug;
```

E aggiorna le chiamate a `getAssetMetaBySlug(...)` e RPC per usare `finalAssetSlug`.

**Step 3: Branch temperatura — usa RPC anomalia invece di delta %**

Subito dopo aver caricato `latestPoint` e `prevValue`, aggiungi:

```ts
let temperatureAnomaly: { anomaly: number | null; baseline_years: number } | null = null;
if (slug === "temperatura" && latestPoint) {
  const supabase = await createServerClient();
  const { data } = await supabase.rpc("get_temperature_anomaly", {
    p_date: latestPoint.observed_at.slice(0, 10),
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (row) {
    temperatureAnomaly = {
      anomaly: row.anomaly ?? null,
      baseline_years: row.baseline_years ?? 0,
    };
  }
}
```

E passa a `LatestValueCard` un nuovo prop opzionale `anomaly` (per ora il `LatestValueCard` mostra solo `delta %`; aggiungiamo branch). Modifica LatestValueCard per supportare:

```tsx
<LatestValueCard
  display_name={assetMeta.display_name_it}
  value={latestPoint.value}
  prev_value={prevValue}
  unit={assetMeta.unit}
  observed_at={latestPoint.observed_at}
  commodity={
    slug === "pun" ? "luce" : slug === "psv" ? "gas" : undefined
  }
  anomaly={temperatureAnomaly?.anomaly ?? undefined}
  baselineLabel={
    temperatureAnomaly && temperatureAnomaly.baseline_years >= 3
      ? `vs media ${new Date().getFullYear() - 5}-${new Date().getFullYear() - 1}`
      : undefined
  }
/>
```

NB: `LatestValueCard` va esteso con i 2 nuovi prop opzionali (`anomaly`, `baselineLabel`).

**Step 4: JSON-LD Dataset per i nuovi indici**

Nel blocco di rendering, aggiungi/aggiorna il chunk Dataset per coprire tutti gli slug. Sostituisci il blocco esistente con un dispatcher:

```ts
const DATASET_DEF: Record<string, { name: string; description: string; keywords: string[]; temporalCoverage: string }> = {
  pun: { /* ... esistente ... */ },
  psv: { /* ... esistente ... */ },
  brent: {
    name: "Brent — Petrolio greggio (spot)",
    description: "Serie storica del prezzo Brent crude oil (North Sea), benchmark europeo del petrolio. Dati giornalieri da EIA Open Data.",
    keywords: ["Brent","petrolio","oil","crude","EIA","commodity"],
    temporalCoverage: "2016-05-13/..",
  },
  co2: {
    name: "CO2 EUA — Quota emissione EU ETS",
    description: "Serie storica del prezzo settlement giornaliero del future EUA (EU Emissions Trading System). Driver del costo elettrico termoelettrico.",
    keywords: ["CO2","EUA","EU ETS","carbon","emissioni","quota"],
    temporalCoverage: "2021-05-13/..",
  },
  temperatura: {
    name: "Temperatura Italia (media nazionale)",
    description: "Serie storica della temperatura media giornaliera in Italia, media pesata di 9 stazioni meteo. Driver dei consumi gas/elettrici.",
    keywords: ["temperatura","Italia","meteo","HDD","CDD","consumi","clima"],
    temporalCoverage: "2021-05-13/..",
  },
};
```

E nel JSX:
```tsx
<script type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: jsonLdString(dataset({
    ...DATASET_DEF[slug],
    url: `https://energyindex.it/it/indice/${slug}`,
  })) }}
/>
```

**Step 5: generateMetadata per i 3 nuovi slug**

Aggiorna `generateMetadata` per gestire i nuovi unit (`$/bbl`, `€/tCO2`, `°C`):

```ts
const priceStr = price !== null
  ? `${NUMBER_2DP.format(price)} ${unit}`
  : "—";

const slugUpper = slug === "temperatura" ? "Temperatura Italia" : slug.toUpperCase();
const title = `${slugUpper} oggi: ${priceStr}`;
```

**Step 6: Run tsc + build**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -20
```

**Step 7: Commit**

```bash
cp "app/[locale]/indice/[slug]/page.tsx" "/tmp/eidx-slice7/app/[locale]/indice/[slug]/page.tsx"
cp components/LatestValueCard.tsx /tmp/eidx-slice7/components/LatestValueCard.tsx
cd /tmp/eidx-slice7
git add "app/[locale]/indice/[slug]/page.tsx" components/LatestValueCard.tsx
git commit -m "feat(indice): supporto pagine brent/co2/temperatura + LatestValueCard con anomalia"
git push origin main
```

---

## Task 10 — FAQ markdown per i 3 nuovi indici

**Files:**
- Create: `content/it/faq/brent.md`
- Create: `content/it/faq/co2.md`
- Create: `content/it/faq/temperatura.md`

Replicare il formato esistente di `content/it/faq/pun.md` (frontmatter + `## Domanda` + risposta in markdown). 5 Q&A ognuno (~150 parole risposta), tone editoriale come PUN/PSV.

**Step 1: Crea i 3 file** secondo lo schema FAQ già in uso (vedi pun.md per template). Argomenti: come da §8 del design doc.

**Step 2: Verifica che la pagina `/it/indice/brent` mostri le FAQ**

```bash
npm run dev
```

Apri `http://localhost:3000/it/indice/brent` → la sezione FAQ deve apparire in fondo.

**Step 3: Commit**

```bash
cp content/it/faq/{brent,co2,temperatura}.md /tmp/eidx-slice7/content/it/faq/
cd /tmp/eidx-slice7
mkdir -p content/it/faq
git add content/it/faq/brent.md content/it/faq/co2.md content/it/faq/temperatura.md
git commit -m "docs(faq): 5 domande per ognuno di Brent / CO2 / Temperatura"
git push origin main
```

---

## Task 11 — Sitemap update

**Files:**
- Modify: `app/sitemap.ts`

**Step 1: Aggiungi 3 URL**

In `app/sitemap.ts`, dentro l'array di ritorno, aggiungi (prima dell'eventuale `}` di chiusura):

```ts
{ url: `${BASE}/it/indice/brent`,        lastModified: now, priority: 0.7, changeFrequency: "daily" },
{ url: `${BASE}/it/indice/co2`,          lastModified: now, priority: 0.7, changeFrequency: "daily" },
{ url: `${BASE}/it/indice/temperatura`,  lastModified: now, priority: 0.6, changeFrequency: "daily" },
```

**Step 2: Build + curl test**

```bash
npm run build
# verifica route /sitemap.xml elencata nell'output
```

**Step 3: Commit**

```bash
cp app/sitemap.ts /tmp/eidx-slice7/app/sitemap.ts
cd /tmp/eidx-slice7
git add app/sitemap.ts
git commit -m "feat(seo): sitemap.xml +3 URL per /indice/brent, /co2, /temperatura"
git push origin main
```

---

## Task 12 — Verifica finale e setup operativo

**Step 1: Test suite completa**

```bash
cd /Users/...
npx vitest run
```

Expected: ≥60 test (47 esistenti + ~13 nuovi: 2 base-ingestor + 2 brent + 3 co2 + 4 temperatura + 3 DriverCard − overlap).

**Step 2: Build completo**

```bash
npm run build 2>&1 | tail -25
```

Expected: build verde, route output mostra tutte le nuove pagine indice come dinamiche.

**Step 3: Setup operativo (richiede azione utente)**

Comunica all'utente:

1. ✅ EIA API key gia' fornita dall'utente (verra' aggiunta a GitHub Secret dal subagent durante l'esecuzione)
2. Open-Meteo: nessuna registrazione necessaria
3. Aggiungi a GitHub Secrets del repo `2appsrl/energyindex`:
   - `EIA_API_KEY` (valore fornito dall'utente)
   (i secret `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` dovrebbero esistere già dall'ETL ARERA — verificare)
4. Lancia i 3 backfill da terminale locale (1 sola volta, ~5 min totali):
   ```bash
   npx tsx scripts/backfill-brent.ts
   npx tsx scripts/backfill-co2.ts
   npx tsx scripts/backfill-temperatura.ts
   ```
5. Verifica primo run schedulato dei 3 workflow su GitHub Actions (tab "Actions" del repo)

**Step 4: Smoke test post-deploy**

Dopo che Netlify deploya il merge in main:

- Aprire https://energyindex.it/it → vedere sezione "Driver di mercato" con 3 card cliccabili
- Click su Brent → pagina indice carica, chart funzionante, FAQ visibili
- Stesso per CO2 e Temperatura
- Test Rich Results Google su https://search.google.com/test/rich-results → incolla `https://energyindex.it/it/indice/brent` → confermare Dataset + FAQPage + Breadcrumb rilevati

Niente commit finale necessario — lo Slice 7 è chiuso al merge dell'ultimo commit dei task precedenti.

---

## Out of scope (rinviato esplicitamente)

Vedi §11 del design doc:
- WTI (solo Brent)
- Conversione Brent EUR (no ETL EUR/USD)
- Consumi gas Snam
- Domanda elettrica Terna
- Modulo predittivo Prophet/XGBoost
- HDD/CDD calcolati
- Pagina `/it/previsioni`
- Breakdown temperature per città

## Rischi e mitigazioni

Vedi §12 del design doc per il dettaglio. I principali sono:
- Ember Climate endpoint instabile → fallback Investing scraping
- Meteostat station ID erronei → verifica manuale a step 6
- Anomalia temperatura senza baseline → UI nasconde se `baseline_years < 3`

## Acceptance criteria

Vedi §13 del design doc.
