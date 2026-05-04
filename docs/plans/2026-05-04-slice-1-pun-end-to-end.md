# Slice 1 — PUN end-to-end Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Energy Index live su `energyindex.it/it/indice/pun` con grafico storico delle ultime 168 ore di PUN, valore corrente, sezione FAQ, CTA verso energiapro.biz, alimentato da un ETL `etl-gme-pun` che gira ogni giorno alle 13:00 ora italiana via `pg_cron`.

**Architecture:** Next.js 15 (App Router, TypeScript, Tailwind, shadcn/ui) deployato su Netlify, alimentato da Supabase Postgres con Edge Functions Deno per l'ETL. I parser puri TS della Fase 0 vengono promossi da `spikes/` a `supabase/functions/_shared/parsers/` come single source per Vitest (Node) ed Edge Functions (Deno) tramite import map. La pagina `/it/indice/pun` è Server Component con ISR 1h che legge da `mv_latest_price_per_asset` e `price_observations`.

**Tech Stack:** Next.js 15 + React 19 + TypeScript 5 + Tailwind 4 + shadcn/ui + next-intl + Supabase JS + lightweight-charts + Vitest + Deno (Supabase Edge Functions) + zod + pg_cron + Netlify + GitHub Actions CI.

**Riferimento al design:** vedi `docs/plans/2026-05-04-fase-1-design.md` (sezioni 3-5 in particolare). Riferimento allo schema dati: `docs/plans/2026-05-01-energy-index-design.md` sezione 6.

**Branch**: `feature/slice-1-pun` (creato all'inizio del Task 1).

---

## Pre-requisiti (manuali, una tantum)

Prima di iniziare i task, l'utente deve confermare/eseguire manualmente:

**M1. Account Supabase pronto**
- Login su https://supabase.com già fatto.
- Creare progetto **`energy-index-prod`**, regione **`eu-west-1` (Ireland)** o **`eu-central-1` (Frankfurt)** — più vicine a Italia.
- Tier: **Free**. Nome DB user: default.
- Salvare le credenziali (Project URL + anon key + service_role key) in un password manager, NON in chat.

**M2. Account Netlify pronto**
- Login su https://netlify.com già fatto.
- Niente progetto da creare ora — sarà collegato al repo GitHub nel Task 14.

**M3. Repo GitHub**
- Creare repo **privato** `deagroup/energyindex` (o nome a piacere) su GitHub.
- Aggiungere come remote: `git remote add origin git@github.com:deagroup/energyindex.git`. Non pushare ancora — primo push nel Task 12.

**M4. DNS register.it pronto a essere modificato**
- Login su register.it dove sono registrati `energyindex.it` e `energyindex.pro`.
- Niente azione ancora — modifiche DNS nel Task 13.

**M5. Resend account** (rinviato a Slice 7, non bloccante per Slice 1).

---

## Task 1: Scaffold Next.js + dependencies + shadcn/ui

**Goal:** Repo pronto come Next.js app con tutte le dipendenze frontend installate.

**Files:**
- Create: `package.json` (sovrascritto da `create-next-app`)
- Create: `app/`, `components/`, `lib/`, `tailwind.config.ts`, `postcss.config.mjs`, `next.config.mjs`, `tsconfig.json` (estesi/sovrascritti)
- Modify: `.gitignore` (aggiungere `.next/`, `out/`)
- Preserve: `spikes/`, `tests/`, `docs/`, esistente `package.json` deps (zod, fast-xml-parser, dotenv, vitest)

**Step 1: Creare branch slice-1**

```bash
git checkout -b feature/slice-1-pun
```

**Step 2: Backup del package.json esistente**

`create-next-app` sovrascriverà `package.json`. Salvare in un file temporaneo le devDependencies esistenti utili (vitest, tsx, fast-xml-parser, zod, dotenv, @types/node).

```bash
cp package.json /tmp/package.json.before-nextjs
```

**Step 3: Eseguire create-next-app in directory corrente**

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm
```

Se chiede "directory not empty, continue?", rispondere **yes**. Sovrascriverà `package.json`, creerà `app/`, `tailwind.config.ts`, ecc. Manterrà `docs/`, `spikes/`, `tests/`, `supabase/` (anche se Supabase ancora non è dir, sarà nel Task 2).

**Step 4: Reinstallare le dipendenze Fase 0**

```bash
npm install --save-dev tsx @types/node vitest
npm install zod fast-xml-parser dotenv
```

Verificare in `package.json` che entrambe le sezioni `devDependencies` e `dependencies` siano popolate correttamente. Manualmente confrontare con `/tmp/package.json.before-nextjs` per non perdere nulla.

**Step 5: Aggiungere altre dipendenze Slice 1**

```bash
npm install next-intl @supabase/supabase-js @supabase/ssr lightweight-charts framer-motion
npm install --save-dev @types/react @types/react-dom
```

**Step 6: Inizializzare shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

Risponde:
- Style: New York
- Base color: Slate
- CSS variables: yes (per dark mode)

Verificare creato: `components/ui/`, `lib/utils.ts`, `components.json`, aggiornato `tailwind.config.ts` e `app/globals.css`.

**Step 7: Aggiungere primitive shadcn necessarie per Slice 1**

```bash
npx shadcn@latest add button card skeleton
```

Verificare creati: `components/ui/button.tsx`, `card.tsx`, `skeleton.tsx`.

**Step 8: Aggiornare `package.json` scripts**

Aggiungere agli `"scripts"`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "spike:gme-pun": "tsx spikes/gme-pun.ts",
    "spike:gme-psv": "tsx spikes/gme-psv.ts",
    "spike:entsoe": "tsx spikes/entsoe-dayahead.ts",
    "spike:arera": "tsx spikes/arera-offers.ts"
  }
}
```

**Step 9: Verificare build pulita**

```bash
npm run build
```

Expected: build completes successfully. La home generata da `create-next-app` viene buildata. Output `.next/` creato.

```bash
npm test
```

Expected: 23/23 test ancora passano (i parser sono ancora in `spikes/`, i test nei `tests/parsers/` li importano da lì, niente è cambiato per loro).

**Step 10: Aggiornare .gitignore**

Aggiungere se mancano:
```
.next/
out/
*.tsbuildinfo
.env*.local
```

**Step 11: Configurare dark mode in Tailwind**

In `tailwind.config.ts` aggiungere `darkMode: "class"` (per usare la classe `.dark` sul `<html>` per il toggle).

**Step 12: Commit**

```bash
git add .
git commit -m "feat(slice-1): scaffold Next.js + Tailwind + shadcn/ui + deps"
```

---

## Task 2: Init Supabase + base schema migration

**Goal:** Progetto Supabase locale collegato al remote, prima migrazione applicata in produzione.

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/migrations/20260505000001_schema.sql`
- Create: `.env.local` (con credentials, gitignored)

**Step 1: Installare Supabase CLI** (se non installata)

```bash
brew install supabase/tap/supabase
supabase --version
```

Expected: versione ≥ 1.150.

**Step 2: Inizializzare progetto locale**

```bash
supabase init
```

Crea `supabase/config.toml` e `supabase/seed.sql` (vuoto). NON crea `migrations/` automaticamente — sarà fatto sotto.

**Step 3: Linkare al progetto remoto**

L'utente fornisce il `<PROJECT_REF>` (la stringa della Supabase URL, tipo `xyzabc123def`). Dal terminale:

```bash
supabase login   # apre browser per autenticarsi
supabase link --project-ref <PROJECT_REF>
```

Verifica con `supabase projects list`.

**Step 4: Creare la migrazione 001 schema**

Create `supabase/migrations/20260505000001_schema.sql`:

```sql
-- Energy Index — Slice 1 — Schema iniziale
-- Documenta: docs/plans/2026-05-01-energy-index-design.md sez. 6

-- ===== Estensioni =====
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- pg_cron timezone -> Europe/Rome (per leggibilità schedule)
ALTER DATABASE postgres SET cron.timezone = 'Europe/Rome';

-- ===== Tabelle =====

CREATE TABLE geography (
  id            BIGSERIAL PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('continent', 'country', 'zone')),
  code          TEXT NOT NULL UNIQUE,
  name_it       TEXT NOT NULL,
  name_en       TEXT,
  parent_id     BIGINT REFERENCES geography(id) ON DELETE RESTRICT,
  geojson_ref   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_geography_parent ON geography(parent_id);

CREATE TABLE assets (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  kind            TEXT NOT NULL CHECK (kind IN ('wholesale_index', 'country_dayahead', 'retail_aggregate')),
  commodity       TEXT NOT NULL CHECK (commodity IN ('electricity', 'gas')),
  unit            TEXT NOT NULL,
  pricing_kind    TEXT NOT NULL DEFAULT 'absolute' CHECK (pricing_kind IN ('absolute', 'spread_on_reference')),
  geography_id    BIGINT NOT NULL REFERENCES geography(id) ON DELETE RESTRICT,
  source          TEXT NOT NULL CHECK (source IN ('gme', 'entsoe', 'arera', 'computed')),
  methodology_url TEXT,
  display_name_it TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_geography ON assets(geography_id);
CREATE INDEX idx_assets_commodity ON assets(commodity);

CREATE TABLE price_observations (
  id              BIGSERIAL PRIMARY KEY,
  asset_id        BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  observed_at     TIMESTAMPTZ NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  value           NUMERIC NOT NULL,
  granularity     TEXT NOT NULL CHECK (granularity IN ('hourly', 'daily', 'quarter_hour')),
  extra           JSONB DEFAULT '{}'::jsonb,
  UNIQUE (asset_id, observed_at)
);

CREATE INDEX idx_price_obs_asset_time ON price_observations(asset_id, observed_at DESC);

CREATE TABLE arera_offers (
  id            BIGSERIAL PRIMARY KEY,
  offer_code    TEXT NOT NULL,
  supplier      TEXT NOT NULL,
  commodity     TEXT NOT NULL CHECK (commodity IN ('electricity', 'gas')),
  price_type    TEXT NOT NULL CHECK (price_type IN ('fisso', 'variabile')),
  price_value   NUMERIC,
  valid_from    TIMESTAMPTZ NOT NULL,
  valid_to      TIMESTAMPTZ,
  raw           JSONB NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_arera_offers_active ON arera_offers(commodity, price_type)
  WHERE valid_to IS NULL OR valid_to > now();

CREATE TABLE energy_index_aggregates (
  id                       BIGSERIAL PRIMARY KEY,
  aggregate_slug           TEXT NOT NULL,
  computed_at              DATE NOT NULL,
  median                   NUMERIC NOT NULL,
  p25                      NUMERIC,
  p75                      NUMERIC,
  min                      NUMERIC NOT NULL,
  max                      NUMERIC NOT NULL,
  sample_size              INT NOT NULL,
  spread_vs_reference_pct  NUMERIC,
  unit                     TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aggregate_slug, computed_at)
);

CREATE TABLE etl_runs (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  status          TEXT NOT NULL CHECK (status IN ('running', 'ok', 'error')),
  rows_ingested   INT,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_etl_runs_source_time ON etl_runs(source, started_at DESC);

-- ===== RLS =====

ALTER TABLE geography ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE arera_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_index_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE etl_runs ENABLE ROW LEVEL SECURITY;

-- Lettura pubblica anonima
CREATE POLICY public_read_geography ON geography FOR SELECT TO anon USING (true);
CREATE POLICY public_read_assets ON assets FOR SELECT TO anon USING (true);
CREATE POLICY public_read_price_observations ON price_observations FOR SELECT TO anon USING (true);
CREATE POLICY public_read_energy_index_aggregates ON energy_index_aggregates FOR SELECT TO anon USING (true);

-- arera_offers e etl_runs NON sono leggibili da anon (restano interne)
-- service_role bypassa sempre RLS — niente policy esplicita per le scritture
```

**Step 5: Applicare la migrazione al remote**

```bash
supabase db push
```

Expected: messaggio "Connecting to remote database..." poi "Applying migration..." poi "Finished".

Se errore "extension pg_cron not enabled": andare nella dashboard Supabase → Database → Extensions → enable `pg_cron` e `pg_net` manualmente. Poi rilanciare `supabase db push`.

**Step 6: Verificare il schema sul remote**

Andare in Supabase Dashboard → Table Editor: dovrebbero esserci `geography`, `assets`, `price_observations`, `arera_offers`, `energy_index_aggregates`, `etl_runs` (vuote tutte).

Andare in Database → Roles → verificare che `anon` ha `SELECT` su `geography`, `assets`, `price_observations`, `energy_index_aggregates` (via RLS policies).

**Step 7: Creare `.env.local` con credenziali**

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-da-dashboard>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-da-dashboard>
```

**Verificare** che `.env.local` è in `.gitignore` (lo è già da Task 1, ma verifica con `git check-ignore -v .env.local`).

**Step 8: Aggiornare `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# (legacy Fase 0)
ENTSOE_API_TOKEN=your_token_here
```

**Step 9: Commit**

```bash
git add supabase/ .env.example
git commit -m "feat(slice-1): Supabase schema migration con 6 tabelle + RLS"
```

---

## Task 3: Seed geography + assets PUN

**Goal:** Popolare le tabelle dimensionali con i dati statici necessari per Slice 1.

**Files:**
- Create: `supabase/migrations/20260505000002_seed_geography.sql`
- Create: `supabase/migrations/20260505000003_seed_assets_pun.sql`

**Step 1: Migrazione seed_geography**

Create `supabase/migrations/20260505000002_seed_geography.sql`:

```sql
-- Continenti
INSERT INTO geography (kind, code, name_it, name_en) VALUES
  ('continent', 'EU', 'Europa', 'Europe');

-- Country IT
INSERT INTO geography (kind, code, name_it, name_en, parent_id, geojson_ref)
SELECT 'country', 'IT', 'Italia', 'Italy', g.id, 'italy'
FROM geography g WHERE g.code = 'EU';

-- 6 Zone MGP italiane (figlie di IT)
INSERT INTO geography (kind, code, name_it, name_en, parent_id, geojson_ref)
SELECT 'zone', 'IT-NORD', 'Nord', 'North', g.id, 'mgp-zone-nord' FROM geography g WHERE g.code = 'IT'
UNION ALL
SELECT 'zone', 'IT-CNOR', 'Centro-Nord', 'Central-North', g.id, 'mgp-zone-cnor' FROM geography g WHERE g.code = 'IT'
UNION ALL
SELECT 'zone', 'IT-CSUD', 'Centro-Sud', 'Central-South', g.id, 'mgp-zone-csud' FROM geography g WHERE g.code = 'IT'
UNION ALL
SELECT 'zone', 'IT-SUD', 'Sud', 'South', g.id, 'mgp-zone-sud' FROM geography g WHERE g.code = 'IT'
UNION ALL
SELECT 'zone', 'IT-SICI', 'Sicilia', 'Sicily', g.id, 'mgp-zone-sici' FROM geography g WHERE g.code = 'IT'
UNION ALL
SELECT 'zone', 'IT-SARD', 'Sardegna', 'Sardinia', g.id, 'mgp-zone-sard' FROM geography g WHERE g.code = 'IT';
```

**Step 2: Migrazione seed_assets_pun**

Create `supabase/migrations/20260505000003_seed_assets_pun.sql`:

```sql
-- PUN nazionale + 6 zonali
INSERT INTO assets (slug, kind, commodity, unit, geography_id, source, display_name_it, methodology_url)
SELECT 'pun', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme',
       'PUN — Prezzo Unico Nazionale',
       'https://www.mercatoelettrico.org/it-it/Home/Esiti/Elettricita/MGP/Esiti/PUN'
FROM geography g WHERE g.code = 'IT'
UNION ALL
SELECT 'pun-zona-nord', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme', 'PUN Zona Nord', NULL
FROM geography g WHERE g.code = 'IT-NORD'
UNION ALL
SELECT 'pun-zona-cnor', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme', 'PUN Zona Centro-Nord', NULL
FROM geography g WHERE g.code = 'IT-CNOR'
UNION ALL
SELECT 'pun-zona-csud', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme', 'PUN Zona Centro-Sud', NULL
FROM geography g WHERE g.code = 'IT-CSUD'
UNION ALL
SELECT 'pun-zona-sud', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme', 'PUN Zona Sud', NULL
FROM geography g WHERE g.code = 'IT-SUD'
UNION ALL
SELECT 'pun-zona-sici', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme', 'PUN Zona Sicilia', NULL
FROM geography g WHERE g.code = 'IT-SICI'
UNION ALL
SELECT 'pun-zona-sard', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme', 'PUN Zona Sardegna', NULL
FROM geography g WHERE g.code = 'IT-SARD';
```

**Step 3: Applicare migrazioni**

```bash
supabase db push
```

**Step 4: Verificare**

Dashboard → Table Editor → `geography`: 8 righe (1 continent + 1 country + 6 zone). `assets`: 7 righe (pun + 6 zonali).

Oppure via psql/SQL editor:
```sql
SELECT g.code, g.name_it, a.slug, a.display_name_it
FROM assets a JOIN geography g ON a.geography_id = g.id
ORDER BY a.slug;
```
Expected: 7 righe.

**Step 5: Commit**

```bash
git add supabase/migrations/2026050500000{2,3}_*.sql
git commit -m "feat(slice-1): seed geography (EU>IT>6 zone MGP) + assets PUN"
```

---

## Task 4: Materialized view + refresh function

**Goal:** `mv_latest_price_per_asset` esiste e una funzione `refresh_latest_price_view()` callable dalle Edge Functions.

**Files:**
- Create: `supabase/migrations/20260505000004_mv_latest_price.sql`

**Step 1: Migrazione**

Create `supabase/migrations/20260505000004_mv_latest_price.sql`:

```sql
-- Materialized view: ultima riga di price_observations per ogni asset
CREATE MATERIALIZED VIEW mv_latest_price_per_asset AS
SELECT DISTINCT ON (po.asset_id)
  po.asset_id,
  a.slug AS asset_slug,
  a.display_name_it,
  a.unit,
  a.commodity,
  a.pricing_kind,
  po.observed_at,
  po.value,
  po.recorded_at
FROM price_observations po
JOIN assets a ON a.id = po.asset_id
ORDER BY po.asset_id, po.observed_at DESC;

-- Index unico necessario per REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_latest_price_asset ON mv_latest_price_per_asset(asset_id);
CREATE INDEX idx_mv_latest_price_slug ON mv_latest_price_per_asset(asset_slug);

-- RLS: la materialized view non supporta RLS direttamente.
-- Workaround: GRANT esplicito su anon.
GRANT SELECT ON mv_latest_price_per_asset TO anon;
GRANT SELECT ON mv_latest_price_per_asset TO authenticated;

-- Funzione di refresh chiamabile da Edge Functions
CREATE OR REPLACE FUNCTION refresh_latest_price_view()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_latest_price_per_asset;
END;
$$;

-- Permesso di chiamare la funzione: solo service_role.
REVOKE EXECUTE ON FUNCTION refresh_latest_price_view() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_latest_price_view() TO service_role;
```

**Step 2: Applicare**

```bash
supabase db push
```

**Step 3: Verificare**

```sql
-- In SQL editor
SELECT * FROM mv_latest_price_per_asset;  -- Vuota (nessun dato in price_observations ancora)
SELECT refresh_latest_price_view();        -- Returns void senza errore
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260505000004_*.sql
git commit -m "feat(slice-1): materialized view mv_latest_price_per_asset + refresh function"
```

---

## Task 5: Promote parsers + `_shared` helpers

**Goal:** Parser puri promossi da `spikes/` a `supabase/functions/_shared/parsers/`. Vitest tests aggiornati per importare da nuova location. Configurato `deno.json` import map.

**Files:**
- Move: `spikes/lib/gme-dnn.ts` → `supabase/functions/_shared/gme-dnn.ts` (refactor: aggiungere export `parseGmePunResponse` separato dal main script)
- Create: `supabase/functions/_shared/parsers/gme-pun.ts` (estratto puro dalla funzione `parseGmePun` di `spikes/gme-pun.ts`)
- Create: `supabase/functions/_shared/deno.json`
- Modify: `tests/parsers/gme-pun.test.ts` (aggiornare import path)
- Preserve: `spikes/gme-pun.ts` (resta come tool, importerà dal _shared)

**Step 1: Estrarre la funzione parser pura**

Aprire `spikes/gme-pun.ts`, identificare `export function parseGmePun(...)` e i tipi/schema zod ad essa associati. Spostare tutto in nuovo file `supabase/functions/_shared/parsers/gme-pun.ts`. La nuova export rimane identica per signature.

```typescript
// supabase/functions/_shared/parsers/gme-pun.ts
import { z } from "zod";

// (spostare qui tutto il contenuto di parseGmePun + GmeRowSchema + altri helper interni)
export function parseGmePun(input: { pun: string; zonal: string[] }): {
  pun_national: Array<{ hour: number; value: number }>;
  zonal: Record<"NORD" | "CNOR" | "CSUD" | "SUD" | "SICI" | "SARD", Array<{ hour: number; value: number }>>;
} {
  // ... codice esistente ...
}
```

**Step 2: Refactor `spikes/gme-pun.ts` per importare dal _shared**

Modificare `spikes/gme-pun.ts`: rimuovere la definizione di `parseGmePun` locale, sostituire con `import { parseGmePun } from "../supabase/functions/_shared/parsers/gme-pun.js";` (Vitest accetta `.js` extension su file `.ts` con ESM bundler resolution).

Rimuovere anche eventuali tipi duplicati ora esportati dal `_shared`.

**Step 3: Aggiornare il test**

In `tests/parsers/gme-pun.test.ts`, modificare l'import:

```typescript
// Prima: import { parseGmePun } from "../../spikes/gme-pun.js";
// Dopo:
import { parseGmePun } from "../../supabase/functions/_shared/parsers/gme-pun.js";
```

**Step 4: Creare deno.json import map**

Create `supabase/functions/_shared/deno.json`:

```json
{
  "imports": {
    "zod": "npm:zod@^3.22.0"
  },
  "compilerOptions": {
    "lib": ["deno.ns", "deno.window", "es2022"],
    "strict": true
  }
}
```

**Step 5: Mover gme-dnn helper**

Spostare `spikes/lib/gme-dnn.ts` → `supabase/functions/_shared/gme-dnn.ts`. Aggiornare l'import in `spikes/gme-pun.ts` e `spikes/gme-psv.ts` da `./lib/gme-dnn.js` a `../supabase/functions/_shared/gme-dnn.js`.

Verificare che `gme-dnn.ts` non usa API Node-only: usa solo `fetch` (cross-runtime), nessun `node:fs`. Se trova `process.env`, sostituire con `globalThis.Deno?.env.get(...) ?? process.env...` patternato per portabilità.

**Step 6: Run tests**

```bash
npm test
```

Expected: 23/23 ancora pass. Se gme-pun.test.ts fallisce per import path, verificare lo step 3.

**Step 7: Run typecheck**

```bash
npm run typecheck
```

Expected: zero errori. Se errori su deno-specific imports nei file `_shared/`, aggiungere `// @ts-ignore deno` localmente o configurare `tsconfig.json` per escludere `supabase/functions/_shared/parsers/` (no — meglio renderli compatibili Node + Deno).

**Step 8: Commit**

```bash
git add .
git commit -m "refactor(slice-1): promote parsers + gme-dnn helper to supabase/functions/_shared/"
```

---

## Task 6: Helpers `_shared`: db.ts + etl-runner.ts

**Goal:** Wrapper `runEtl(name, fn)` riusato da tutti gli ETL. Client DB con service_role.

**Files:**
- Create: `supabase/functions/_shared/db.ts`
- Create: `supabase/functions/_shared/etl-runner.ts`

**Step 1: db.ts**

Create `supabase/functions/_shared/db.ts`:

```typescript
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@^2.39.0";

export function dbServiceRole(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function refreshLatestPriceView(db: SupabaseClient): Promise<void> {
  const { error } = await db.rpc("refresh_latest_price_view");
  if (error) throw new Error(`refresh_latest_price_view: ${error.message}`);
}
```

**Step 2: etl-runner.ts**

Create `supabase/functions/_shared/etl-runner.ts`:

```typescript
import { dbServiceRole } from "./db.ts";

export interface EtlContext {
  log: (msg: string, extra?: Record<string, unknown>) => void;
}

export interface EtlResult {
  rows_ingested: number;
  metadata?: Record<string, unknown>;
}

export async function runEtl(
  source: string,
  fn: (ctx: EtlContext) => Promise<EtlResult>,
): Promise<Response> {
  const db = dbServiceRole();
  const startedAt = new Date().toISOString();
  const logs: Array<{ msg: string; extra?: Record<string, unknown>; ts: string }> = [];
  const ctx: EtlContext = {
    log: (msg, extra) => logs.push({ msg, extra, ts: new Date().toISOString() }),
  };

  // 1. Insert running row
  const { data: runRow, error: insertErr } = await db
    .from("etl_runs")
    .insert({ source, started_at: startedAt, status: "running" })
    .select("id")
    .single();

  if (insertErr || !runRow) {
    return new Response(
      JSON.stringify({ ok: false, error: `cannot insert etl_runs: ${insertErr?.message}` }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const runId = runRow.id;

  try {
    const result = await fn(ctx);
    await db.from("etl_runs").update({
      finished_at: new Date().toISOString(),
      status: "ok",
      rows_ingested: result.rows_ingested,
      metadata: { ...result.metadata, logs },
    }).eq("id", runId);
    return new Response(
      JSON.stringify({ ok: true, run_id: runId, ...result }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("etl_runs").update({
      finished_at: new Date().toISOString(),
      status: "error",
      error_message: message,
      metadata: { logs },
    }).eq("id", runId);
    return new Response(
      JSON.stringify({ ok: false, run_id: runId, error: message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
```

Nota: niente retry/backoff in v1 dell'helper — pg_cron riproverà al run successivo. Retry interni a singolo ETL sono opzionali, non bloccanti.

**Step 3: Commit**

```bash
git add supabase/functions/_shared/
git commit -m "feat(slice-1): _shared helpers db.ts + etl-runner.ts"
```

---

## Task 7: Edge Function `etl-gme-pun`

**Goal:** Edge Function deployabile che scarica PUN del giorno, fa UPSERT in `price_observations`, refresha la view.

**Files:**
- Create: `supabase/functions/etl-gme-pun/index.ts`
- Create: `supabase/functions/etl-gme-pun/deno.json`

**Step 1: index.ts**

Create `supabase/functions/etl-gme-pun/index.ts`:

```typescript
import { runEtl } from "../_shared/etl-runner.ts";
import { bootstrapGmeDnnSession, gmeApiGet } from "../_shared/gme-dnn.ts";
import { parseGmePun } from "../_shared/parsers/gme-pun.ts";
import { dbServiceRole, refreshLatestPriceView } from "../_shared/db.ts";

const PAGE_PATH = "/it-it/Home/Esiti/Elettricita/MGP/Esiti/PUN";
const ZONES = ["NORD", "CNOR", "CSUD", "SUD", "SICI", "SARD"] as const;
type Zone = typeof ZONES[number];

function isoDateInRome(d: Date = new Date()): string {
  // returns YYYY-MM-DD in Europe/Rome
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(d);
}

function compactDate(iso: string): string {
  return iso.replace(/-/g, "");
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async () => {
  return runEtl("gme-pun", async (ctx) => {
    const session = await bootstrapGmeDnnSession(PAGE_PATH);
    ctx.log("dnn session ok", { tabId: session.tabId, moduleId: session.moduleId });

    let date = isoDateInRome();
    let punRaw = await gmeApiGet(session, {
      mercato: "MGP", zona: "PUN", tipologia: "PUN",
      dataInizio: compactDate(date), dataFine: compactDate(date), granularita: "h",
    });

    let parsed = parseGmePun({ pun: punRaw, zonal: [] }); // first try only PUN
    if (parsed.pun_national.length === 0) {
      // Fallback: yesterday
      date = addDaysIso(date, -1);
      ctx.log("today empty, fallback to yesterday", { date });
      punRaw = await gmeApiGet(session, {
        mercato: "MGP", zona: "PUN", tipologia: "PUN",
        dataInizio: compactDate(date), dataFine: compactDate(date), granularita: "h",
      });
    }

    const zonalRaw: string[] = [];
    for (const z of ZONES) {
      const r = await gmeApiGet(session, {
        mercato: "MGP", zona: z, tipologia: "PrezziZonali",
        dataInizio: compactDate(date), dataFine: compactDate(date), granularita: "h",
      });
      zonalRaw.push(r);
    }

    parsed = parseGmePun({ pun: punRaw, zonal: zonalRaw });
    if (parsed.pun_national.length !== 24) {
      throw new Error(`expected 24 PUN values, got ${parsed.pun_national.length}`);
    }
    ctx.log("parsed", { national: parsed.pun_national.length, zones: Object.keys(parsed.zonal).length });

    // Map asset slugs
    const slugMap: Record<Zone | "NATIONAL", string> = {
      NATIONAL: "pun",
      NORD: "pun-zona-nord", CNOR: "pun-zona-cnor", CSUD: "pun-zona-csud",
      SUD: "pun-zona-sud", SICI: "pun-zona-sici", SARD: "pun-zona-sard",
    };

    const db = dbServiceRole();

    // Get asset ids
    const slugs = Object.values(slugMap);
    const { data: assets, error: assetErr } = await db
      .from("assets").select("id, slug").in("slug", slugs);
    if (assetErr || !assets) throw new Error(`fetch assets: ${assetErr?.message}`);
    const slugToId = new Map(assets.map(a => [a.slug, a.id]));

    // Build rows: 24 hours x 7 series
    const rows: Array<{ asset_id: number; observed_at: string; value: number; granularity: string; extra: object }> = [];
    for (const point of parsed.pun_national) {
      const id = slugToId.get("pun");
      if (!id) throw new Error("asset 'pun' not seeded");
      rows.push({
        asset_id: id,
        observed_at: hourToIso(date, point.hour),
        value: point.value,
        granularity: "hourly",
        extra: { source_hour: point.hour },
      });
    }
    for (const z of ZONES) {
      const series = parsed.zonal[z] ?? [];
      const id = slugToId.get(slugMap[z]);
      if (!id) throw new Error(`asset '${slugMap[z]}' not seeded`);
      for (const point of series) {
        rows.push({
          asset_id: id,
          observed_at: hourToIso(date, point.hour),
          value: point.value,
          granularity: "hourly",
          extra: { source_hour: point.hour, zone: z },
        });
      }
    }

    // UPSERT
    const { error: upsertErr } = await db
      .from("price_observations")
      .upsert(rows, { onConflict: "asset_id,observed_at" });
    if (upsertErr) throw new Error(`upsert: ${upsertErr.message}`);
    ctx.log("upserted", { rows: rows.length });

    // Refresh materialized view
    await refreshLatestPriceView(db);
    ctx.log("mv refreshed");

    return { rows_ingested: rows.length, metadata: { date } };
  });
});

function hourToIso(date: string, hour: number): string {
  // hour: 1..24 (or 25 in DST autumn). Convert to ISO timestamp Europe/Rome.
  // Energy market convention: hour 1 = 00:00-01:00, hour 24 = 23:00-24:00.
  const h = String(hour - 1).padStart(2, "0");
  return `${date}T${h}:00:00+02:00`; // Naive: assumes CEST. For correctness, would need DST-aware logic.
  // NOTE Slice 1: this works year-round during CEST. CET (winter) → tz +01:00.
  // For Slice 1 we accept this approximation; Slice 7 hardening will fix DST tz.
}
```

**Step 2: deno.json per la function**

Create `supabase/functions/etl-gme-pun/deno.json`:

```json
{
  "imports": {
    "zod": "npm:zod@^3.22.0"
  }
}
```

**Step 3: Deploy della function al remote**

```bash
supabase functions deploy etl-gme-pun --no-verify-jwt
```

`--no-verify-jwt` perché la function sarà invocata da `pg_cron` con `service_role_key` direttamente, non da utenti autenticati con JWT.

Expected: deploy success, URL ritornato tipo `https://<PROJECT_REF>.supabase.co/functions/v1/etl-gme-pun`.

**Step 4: Test manuale**

```bash
# Da terminale, con curl:
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/etl-gme-pun" \
  -H "Authorization: Bearer <service_role_key>"
```

Expected: HTTP 200, JSON `{ "ok": true, "run_id": <int>, "rows_ingested": 168, "metadata": { "date": "2026-05-04" } }`.

Se errore: andare in Supabase Dashboard → Edge Functions → `etl-gme-pun` → Logs per vedere lo stack trace.

**Step 5: Verificare DB**

```sql
SELECT count(*) FROM price_observations;
-- Expected: 168 (24 ore × 7 series)

SELECT a.slug, count(*), min(po.value), max(po.value)
FROM price_observations po JOIN assets a ON po.asset_id = a.id
GROUP BY a.slug ORDER BY a.slug;
-- Expected: 7 righe, ognuna con count=24

SELECT * FROM mv_latest_price_per_asset ORDER BY asset_slug;
-- Expected: 7 righe, latest value per asset
```

**Step 6: Commit**

```bash
git add supabase/functions/etl-gme-pun/
git commit -m "feat(slice-1): edge function etl-gme-pun + manual run produces 168 rows"
```

---

## Task 8: Schedule pg_cron + smoke daily run

**Goal:** `etl-gme-pun` schedulato ogni giorno alle 13:00 Europe/Rome.

**Files:**
- Create: `supabase/migrations/20260505000005_pg_cron_etl_pun.sql`

**Step 1: Migrazione cron**

Create `supabase/migrations/20260505000005_pg_cron_etl_pun.sql`:

```sql
-- Salva i secrets necessari come settings DB (devono essere disponibili a pg_cron via current_setting)
-- NOTA: questi valori devono essere settati MANUALMENTE prima/dopo questa migrazione
-- via Supabase Dashboard -> Database -> Configuration -> Custom Postgres Config:
--   app.supabase_url = 'https://<PROJECT_REF>.supabase.co'
--   app.service_role_key = '<service_role_key>'

SELECT cron.schedule(
  'etl-gme-pun-daily',
  '0 13 * * *',  -- 13:00 ogni giorno (Europe/Rome via cron.timezone)
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/etl-gme-pun',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  ) as request_id;
  $$
);
```

**Step 2: Configurare i secrets postgres**

Nella Supabase Dashboard → Project Settings → Database → Custom Postgres Config (oppure via SQL):

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://<PROJECT_REF>.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = '<service_role_key>';
```

(Eseguire da SQL editor con role superuser. Questi setting persistono al restart.)

**Step 3: Applicare migrazione**

```bash
supabase db push
```

**Step 4: Verificare lo schedule è attivo**

```sql
SELECT jobid, schedule, command, jobname
FROM cron.job WHERE jobname = 'etl-gme-pun-daily';
-- Expected: 1 riga
```

**Step 5: Test manuale del trigger pg_cron**

```sql
-- Force execution one time to verify the wiring (non aspettare le 13:00):
SELECT cron.schedule(
  'etl-gme-pun-test-now',
  '* * * * *',  -- ogni minuto
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/etl-gme-pun',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  );
  $$
);

-- Aspettare 1-2 minuti, verificare etl_runs:
SELECT id, started_at, status, rows_ingested FROM etl_runs ORDER BY id DESC LIMIT 3;

-- Cancellare il test cron:
SELECT cron.unschedule('etl-gme-pun-test-now');
```

Expected: `etl_runs` ha una nuova riga `status='ok'`, `rows_ingested=168`.

**Step 6: Commit**

```bash
git add supabase/migrations/20260505000005_*.sql
git commit -m "feat(slice-1): pg_cron schedule etl-gme-pun daily 13:00 Europe/Rome"
```

---

## Task 9: Setup Next.js (i18n + Supabase clients + theme + layout)

**Goal:** Routing `/it/...` funzionante, client Supabase per Server Components, dark/light theme toggle, layout base con header e footer placeholder.

**Files:**
- Create: `lib/i18n/config.ts`
- Create: `lib/supabase/server.ts`, `lib/supabase/browser.ts`
- Modify: `app/layout.tsx` (root layout)
- Create: `app/[locale]/layout.tsx`
- Modify: `app/page.tsx` → redirect a `/it`
- Create: `middleware.ts` (i18n routing)
- Create: `components/site-header.tsx`, `components/site-footer.tsx`
- Create: `components/theme-toggle.tsx`
- Modify: `app/globals.css` (CSS variables per dark theme)

**Step 1: Configurare next-intl**

Create `lib/i18n/config.ts`:

```typescript
export const locales = ["it"] as const; // v2 aggiungerà "en", "de", "fr"
export const defaultLocale = "it" as const;
export type Locale = typeof locales[number];
```

Create `i18n.ts` (root level, richiesto da next-intl):

```typescript
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, locales } from "./lib/i18n/config";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as typeof locales[number])) {
    locale = defaultLocale;
  }
  return {
    locale,
    messages: {} // niente traduzioni attive in v1, struttura pronta per v2
  };
});
```

**Step 2: Configurare middleware i18n**

Create `middleware.ts` (root level):

```typescript
import createMiddleware from "next-intl/middleware";
import { defaultLocale, locales } from "./lib/i18n/config";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always", // forza /it/... anche se solo lingua
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

**Step 3: Aggiornare next.config.mjs**

```javascript
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
};

export default withNextIntl(nextConfig);
```

**Step 4: Supabase clients**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // pagina readonly per ora
      },
    },
  );
}
```

Create `lib/supabase/browser.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

**Step 5: Root layout** (sovrascrivi il default di create-next-app)

Modify `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: { default: "Energy Index", template: "%s | Energy Index" },
  description: "Osservatorio prezzi luce e gas in tempo reale.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={inter.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased">{children}</body>
    </html>
  );
}
```

**Step 6: Locale layout**

Create `app/[locale]/layout.tsx`:

```typescript
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n/config";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-dvh flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
    </NextIntlClientProvider>
  );
}
```

**Step 7: Components header + footer + theme toggle**

Create `components/theme-toggle.tsx` (client):

```typescript
"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("ei-theme") as "light" | "dark" | null;
    const initial = stored ?? "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("ei-theme", next);
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} aria-label="Toggle theme">
      {theme === "dark" ? "🌙" : "☀️"}
    </Button>
  );
}
```

Create `components/site-header.tsx` (server):

```typescript
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/it" className="font-bold tabular-nums tracking-tight">Energy Index</Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
```

Create `components/site-footer.tsx`:

```typescript
export function SiteFooter() {
  return (
    <footer className="border-t mt-16">
      <div className="container mx-auto px-4 py-8 text-sm text-muted-foreground space-y-2">
        <p>
          Fonte: GME — Gestore dei Mercati Energetici. Dati riprodotti per uso informativo.
        </p>
        <p>
          © 2026 Energy Index — un progetto di DEA Group.
          <a href="https://energiapro.biz" className="ml-2 underline">Vai a energiapro.biz</a>
        </p>
      </div>
    </footer>
  );
}
```

**Step 8: Aggiornare globals.css con CSS variables dark mode**

shadcn/ui ha già configurato le variables CSS in `app/globals.css` durante init. Verificare che `:root.dark { ... }` ci sia. Aggiustare colori se necessario per look "Bloomberg" (sfondo molto scuro #0a0e14, accenti verde #14d97a / rosso #ff4d4f).

**Step 9: Sostituire `app/page.tsx` con redirect a `/it`**

```typescript
import { redirect } from "next/navigation";
export default function RootPage() {
  redirect("/it");
}
```

**Step 10: Creare placeholder `app/[locale]/page.tsx`**

```typescript
import Link from "next/link";

export default function HomeIt() {
  return (
    <div className="container mx-auto py-16 px-4 space-y-4">
      <h1 className="text-4xl font-bold">Energy Index</h1>
      <p>Osservatorio prezzi luce e gas in tempo reale.</p>
      <p>
        <Link href="/it/indice/pun" className="underline text-primary">Vedi il PUN di oggi →</Link>
      </p>
    </div>
  );
}
```

**Step 11: Test build**

```bash
npm run build
```

Expected: build completes. Visualizzando `npm run dev` poi su browser `http://localhost:3000` redirect a `http://localhost:3000/it`, vede la home placeholder.

**Step 12: Commit**

```bash
git add .
git commit -m "feat(slice-1): Next.js i18n routing + theme toggle + Supabase clients + layout base"
```

---

## Task 10: Component `<PriceChart>` + `<LatestValueCard>`

**Goal:** Componenti riusabili per visualizzare time series e ultimo valore.

**Files:**
- Create: `components/chart/PriceChart.tsx` (client component)
- Create: `components/LatestValueCard.tsx` (server component)
- Create: `lib/format/index.ts`

**Step 1: Helper formatters**

Create `lib/format/index.ts`:

```typescript
const eurFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export function formatEurMwh(value: number): string {
  return `${eurFormatter.format(value)}/MWh`;
}

export function formatPercentDelta(curr: number, prev: number): string {
  if (prev === 0) return "—";
  const pct = ((curr - prev) / prev) * 100;
  const sign = pct >= 0 ? "▲" : "▼";
  return `${sign} ${Math.abs(pct).toFixed(1)}%`;
}

export function formatRelativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "ora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ore fa`;
  return `${Math.floor(diff / 86400)} g fa`;
}
```

**Step 2: PriceChart component**

Create `components/chart/PriceChart.tsx`:

```typescript
"use client";
import { useEffect, useRef } from "react";
import {
  createChart, type IChartApi, type ISeriesApi, AreaSeries,
} from "lightweight-charts";

export interface PricePoint {
  observed_at: string;
  value: number;
}

export function PriceChart({ points, unit }: { points: PricePoint[]; unit: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = document.documentElement.classList.contains("dark");
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { color: "transparent" },
        textColor: isDark ? "#e5e7eb" : "#1f2937",
      },
      grid: {
        vertLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
        horzLines: { color: isDark ? "#1f2937" : "#e5e7eb" },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
      localization: {
        priceFormatter: (v: number) => `${v.toFixed(2)} ${unit}`,
      },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#14d97a",
      topColor: "rgba(20, 217, 122, 0.4)",
      bottomColor: "rgba(20, 217, 122, 0.0)",
    });

    series.setData(points.map(p => ({
      time: Math.floor(new Date(p.observed_at).getTime() / 1000) as never,
      value: p.value,
    })));

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const onResize = () => chart.applyOptions({ width: containerRef.current!.clientWidth });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [points, unit]);

  return <div ref={containerRef} className="w-full" />;
}
```

**Step 3: LatestValueCard component**

Create `components/LatestValueCard.tsx`:

```typescript
import { Card } from "@/components/ui/card";
import { formatEurMwh, formatPercentDelta, formatRelativeTime } from "@/lib/format";

export interface LatestValueProps {
  value: number;
  unit: string;
  observed_at: string;
  prev_value?: number;
  display_name: string;
}

export function LatestValueCard({ value, unit, observed_at, prev_value, display_name }: LatestValueProps) {
  const delta = prev_value !== undefined ? formatPercentDelta(value, prev_value) : null;
  const isUp = prev_value !== undefined && value >= prev_value;

  return (
    <Card className="p-6 flex flex-col gap-2">
      <div className="text-sm text-muted-foreground">{display_name}</div>
      <div className="text-4xl font-bold tabular-nums">
        {unit === "€/MWh" ? formatEurMwh(value) : `${value.toFixed(2)} ${unit}`}
      </div>
      {delta && (
        <div className={`text-sm tabular-nums ${isUp ? "text-emerald-500" : "text-rose-500"}`}>
          {delta}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        Aggiornato {formatRelativeTime(observed_at)}
      </div>
    </Card>
  );
}
```

**Step 4: Smoke render in dev**

Modify temporaneamente `app/[locale]/page.tsx` per testare:

```typescript
import { LatestValueCard } from "@/components/LatestValueCard";

export default function Home() {
  return (
    <div className="container mx-auto py-16 px-4">
      <LatestValueCard
        display_name="PUN test" value={142.30} prev_value={138.50} unit="€/MWh"
        observed_at={new Date().toISOString()}
      />
    </div>
  );
}
```

`npm run dev` → verificare che la card si veda correttamente (dark mode default).

Poi rimettere il placeholder originale.

**Step 5: Commit**

```bash
git add components/ lib/format/
git commit -m "feat(slice-1): components PriceChart + LatestValueCard + formatters"
```

---

## Task 11: Pagina `/it/indice/pun` end-to-end

**Goal:** La pagina `/it/indice/pun` carica dati reali da Supabase, mostra grafico + card valore corrente + FAQ + CTA verso energiapro.

**Files:**
- Create: `app/[locale]/indice/[slug]/page.tsx`
- Create: `content/it/faq/pun.md`
- Create: `components/FaqSection.tsx`
- Create: `components/CtaToEnergiapro.tsx`
- Modify: `package.json` (aggiungere `gray-matter` per markdown frontmatter)

**Step 1: Installare gray-matter**

```bash
npm install gray-matter
```

**Step 2: Page component**

Create `app/[locale]/indice/[slug]/page.tsx`:

```typescript
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { LatestValueCard } from "@/components/LatestValueCard";
import { PriceChart } from "@/components/chart/PriceChart";
import { FaqSection } from "@/components/FaqSection";
import { CtaToEnergiapro } from "@/components/CtaToEnergiapro";

export const revalidate = 3600;
export const dynamicParams = true;

const SUPPORTED_SLUGS = ["pun", "psv"] as const;

export default async function IndicePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  if (!SUPPORTED_SLUGS.includes(slug as typeof SUPPORTED_SLUGS[number])) notFound();

  const supabase = await createServerClient();

  // Latest
  const { data: latest } = await supabase
    .from("mv_latest_price_per_asset")
    .select("*")
    .eq("asset_slug", slug)
    .maybeSingle();

  if (!latest) {
    return (
      <div className="container mx-auto py-16 px-4">
        <h1 className="text-3xl font-bold">Dati in arrivo</h1>
        <p className="mt-4 text-muted-foreground">
          La prima rilevazione dell'indice {slug.toUpperCase()} arriverà al prossimo aggiornamento.
        </p>
      </div>
    );
  }

  // Storico ultime 168 ore (1 settimana di PUN)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: history } = await supabase
    .from("price_observations")
    .select("observed_at, value")
    .eq("asset_id", latest.asset_id)
    .gte("observed_at", oneWeekAgo)
    .order("observed_at", { ascending: true });

  const points = history ?? [];

  // Calcolare prev_value (penultimo punto) per la card delta
  const prevValue = points.length >= 2 ? points[points.length - 2].value : undefined;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tabular-nums">{latest.display_name_it}</h1>
        <p className="text-muted-foreground">
          Prezzo Unico Nazionale del mercato elettrico italiano. Asta MGP del giorno prima, esiti pubblicati intorno alle 12:30.
        </p>
      </header>

      <LatestValueCard
        display_name={latest.display_name_it}
        value={Number(latest.value)}
        prev_value={prevValue}
        unit={latest.unit}
        observed_at={latest.observed_at}
      />

      <section>
        <h2 className="text-xl font-semibold mb-4">Andamento ultime 168 ore</h2>
        <PriceChart points={points} unit={latest.unit} />
      </section>

      <FaqSection slug={slug} />

      <CtaToEnergiapro campaign={`indice-${slug}`} />
    </div>
  );
}
```

**Step 3: FAQ markdown content**

Create `content/it/faq/pun.md`:

```markdown
---
title: "Domande frequenti — PUN"
---

## Cos'è il PUN?

Il PUN (Prezzo Unico Nazionale) è il prezzo all'ingrosso dell'energia elettrica in Italia, determinato giornalmente dall'asta del Mercato del Giorno Prima (MGP) gestita da GME. Dal 1° gennaio 2025 il PUN è calcolato come media ponderata sui volumi negoziati nelle 7 zone di mercato (PUN Index GME).

## Quando viene aggiornato?

Ogni giorno intorno alle 12:30, dopo la chiusura dell'asta MGP. I prezzi pubblicati si riferiscono alle 24 ore del giorno successivo.

## Perché ci sono valori diversi per zona?

In presenza di congestioni di rete, le zone (Nord, Centro-Nord, Centro-Sud, Sud, Sicilia, Sardegna) possono avere prezzi diversi tra loro. Il PUN nazionale è la media ponderata delle 7 zone.

## Posso passare a una tariffa basata sul PUN?

Sì. Le offerte "variabili" indicizzate al PUN aggiungono uno spread fisso al prezzo PUN. Su [energiapro.biz](https://energiapro.biz) puoi confrontare tutte le offerte luce sul mercato libero.
```

**Step 4: FaqSection component**

Create `components/FaqSection.tsx`:

```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";

export async function FaqSection({ slug }: { slug: string }) {
  let content = "";
  try {
    const file = await readFile(join(process.cwd(), "content/it/faq", `${slug}.md`), "utf-8");
    const parsed = matter(file);
    content = parsed.content;
  } catch {
    return null;
  }

  // Naive markdown rendering: split by ## and emit h2/p
  const sections = content.split(/^## /m).filter(Boolean);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Domande frequenti</h2>
      <div className="space-y-4">
        {sections.map((s, i) => {
          const [question, ...rest] = s.split("\n");
          const answer = rest.join("\n").trim();
          return (
            <div key={i} className="border-l-2 border-primary/30 pl-4">
              <h3 className="font-medium">{question.trim()}</h3>
              <p className="text-muted-foreground mt-1 whitespace-pre-line">{answer}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

**Step 5: CtaToEnergiapro component**

Create `components/CtaToEnergiapro.tsx`:

```typescript
import { Card } from "@/components/ui/card";

export function CtaToEnergiapro({ campaign }: { campaign: string }) {
  const url = `https://energiapro.biz/?utm_source=energy-index&utm_medium=cta&utm_campaign=${encodeURIComponent(campaign)}`;
  return (
    <Card className="p-6 bg-primary/5 border-primary/30">
      <h3 className="text-lg font-semibold">Vuoi una tariffa migliore?</h3>
      <p className="mt-2 text-muted-foreground">
        Confronta tutte le offerte luce e gas del mercato libero su energiapro.biz.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener"
        className="inline-block mt-4 px-4 py-2 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90"
      >
        Vai al comparatore →
      </a>
    </Card>
  );
}
```

**Step 6: Test in dev**

```bash
npm run dev
```

Aprire `http://localhost:3000/it/indice/pun`. Expected:
- Header con titolo "PUN — Prezzo Unico Nazionale"
- Card con valore corrente del PUN reale (ottenuto dal Task 7 ETL)
- Grafico delle ultime 168 ore (anche se molto poche se ETL girato 1 sola volta — è ok)
- FAQ section con 4 Q&A
- Card CTA azzurra con link a energiapro

Se la pagina mostra "Dati in arrivo": il task 7 ETL non ha girato. Re-eseguirlo manualmente prima di proseguire.

**Step 7: Test build**

```bash
npm run build
```

Expected: build success.

**Step 8: Commit**

```bash
git add .
git commit -m "feat(slice-1): pagina /it/indice/pun end-to-end con grafico + FAQ + CTA"
```

---

## Task 12: GitHub Actions CI

**Goal:** CI verde su PR che bocca il merge se typecheck o test rosso.

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-db.yml`

**Step 1: ci.yml**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
```

**Step 2: deploy-db.yml**

Create `.github/workflows/deploy-db.yml`:

```yaml
name: Deploy DB migrations
on:
  push:
    branches: [main]
    paths:
      - "supabase/migrations/**"
      - ".github/workflows/deploy-db.yml"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      - run: supabase db push --include-all --linked
        env:
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

**Step 3: Configurare GitHub secrets**

L'utente va su GitHub repo → Settings → Secrets and variables → Actions, crea:
- `SUPABASE_ACCESS_TOKEN`: ottenuto da `supabase login --token` o dashboard "Access Tokens"
- `SUPABASE_PROJECT_REF`: la stringa del progetto
- `SUPABASE_DB_PASSWORD`: il DB password salvato in M1

**Step 4: Push del repo**

```bash
git push -u origin feature/slice-1-pun
```

(Se errore "remote does not exist", l'utente deve aver creato il repo GitHub in M3 e configurato `git remote add origin ...`.)

**Step 5: Aprire PR su GitHub**

Vai su GitHub, "Compare & pull request" da `feature/slice-1-pun` verso `main`. Verificare che CI gira automaticamente. Aspettare che diventi verde.

**Step 6: Commit aggiornamenti se serve**

Se CI rosso, debug e push fix. Quando verde, **NON mergiare ancora** — il merge avverrà nel Task 14 dopo il deploy Netlify funzionante.

```bash
# Se servono fix, commit normalmente; il push aggiorna la PR
git add .github/
git commit -m "feat(slice-1): GitHub Actions CI + deploy-db workflow"
git push
```

---

## Task 13: Netlify setup + DNS configuration

**Goal:** Deploy preview funzionante per la PR, dominio `energyindex.it` collegato (verrà attivato in produzione al merge), `.pro` 301 → `.it`.

**Files:**
- Create: `netlify.toml`

**Step 1: netlify.toml**

Create `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NEXT_TELEMETRY_DISABLED = "1"
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"

# Redirect .pro -> .it
[[redirects]]
  from = "https://energyindex.pro/*"
  to = "https://energyindex.it/:splat"
  status = 301
  force = true

[[redirects]]
  from = "https://www.energyindex.pro/*"
  to = "https://energyindex.it/:splat"
  status = 301
  force = true

[[redirects]]
  from = "https://www.energyindex.it/*"
  to = "https://energyindex.it/:splat"
  status = 301
  force = true
```

**Step 2: Connettere repo a Netlify** (manuale via UI)

L'utente:
1. Login su Netlify → "Add new site" → "Import an existing project" → GitHub → seleziona repo `energyindex`.
2. Branch da deployare: lascia `main` come default. Per le PR Netlify deploya preview automaticamente.
3. Build settings: `npm run build`, publish dir `.next`. (verranno auto-rilevate da `netlify.toml`).
4. Environment variables (Site settings → Env): aggiungere
   - `NEXT_PUBLIC_SUPABASE_URL` = stesso valore di `.env.local`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = stesso valore di `.env.local`

**Step 3: Aspettare il primo deploy preview**

Quando push del Task 12 attiva la build Netlify per la PR, aspettare URL preview (formato `https://deploy-preview-1--<sitename>.netlify.app/`). Aprire e verificare:
- `/` redirige a `/it`
- `/it/indice/pun` mostra dati
- Toggle dark/light funziona

Se errore "Cannot find module @supabase/...": verificare che `npm ci` ha installato tutto. Verificare in netlify.toml `NODE_VERSION = "20"`.

**Step 4: Configurare custom domains su Netlify**

In Netlify → Site → Domain management → "Add custom domain":
1. `energyindex.it` (primary)
2. `energyindex.pro` (alias)

Netlify mostra i record DNS da aggiungere su register.it.

**Step 5: Configurare DNS su register.it**

Login register.it → `energyindex.it` → DNS:
- Record A `@` → IP load balancer Netlify (mostrato da Netlify)
- Record CNAME `www` → `<sitename>.netlify.app`

Lo stesso per `energyindex.pro`. Netlify gestisce SSL via Let's Encrypt automaticamente entro ~10 minuti dalla configurazione DNS.

**Step 6: Verificare DNS propagation**

```bash
dig energyindex.it
dig energyindex.pro
```

Aspettare che il record A punti agli IP Netlify. Tempo: 5 min - 24 h (di solito <1 h).

**Step 7: Commit netlify.toml**

```bash
git add netlify.toml
git commit -m "feat(slice-1): netlify.toml con redirect .pro -> .it e plugin Next.js"
git push
```

---

## Task 14: Production deploy + tag slice-1-ok

**Goal:** PR mergiata, sito live su `https://energyindex.it/it/indice/pun`.

**Step 1: Verificare CI verde + preview Netlify ok**

Sulla PR aperta in Task 12:
- CI workflow: ✅ verde (typecheck + test + build).
- Netlify deploy preview: ✅ pagina si carica correttamente, dati PUN visibili.

Se uno dei due rosso: fixare e ripetere step.

**Step 2: Merge PR su main**

Da GitHub UI: "Merge pull request" → preferire "Create a merge commit" (no squash, mantiene la storia dei commit della slice).

Oppure da terminal:
```bash
git checkout main
git pull
git merge --no-ff feature/slice-1-pun -m "merge: slice 1 — PUN end-to-end"
git push
```

**Step 3: Verificare deploy produzione**

Aspettare 2-3 min per la build Netlify. Visitare:
- `https://energyindex.it` → redirige a `/it`
- `https://energyindex.it/it/indice/pun` → pagina PUN con dati reali
- `https://energyindex.pro/it/indice/pun` → 301 redirige a `https://energyindex.it/it/indice/pun`

Toggle dark/light, controllo grafico, FAQ, CTA verso energiapro. Tutto deve funzionare.

**Step 4: Verificare ETL daily schedulato**

```sql
-- Domani alle 13:00+ Europe/Rome verificare che pg_cron è girato:
SELECT * FROM etl_runs WHERE source = 'gme-pun' ORDER BY id DESC LIMIT 5;
```

Se la slice è stata completata in mattinata, aspettare le 13:00 dello stesso giorno o il giorno successivo. Status atteso: `ok`, `rows_ingested: 168`.

**Step 5: Tag slice-1-ok**

```bash
git tag -a slice-1-ok -m "Slice 1 — PUN end-to-end completata. /it/indice/pun live su energyindex.it. ETL daily 13:00."
git push origin slice-1-ok
```

**Step 6: Cleanup branch locale**

```bash
git branch -d feature/slice-1-pun
```

**Step 7: Aggiornare design doc Fase 1**

Modify `docs/plans/2026-05-04-fase-1-design.md`:
- Sezione 2 (Roadmap): cambiare la riga Slice 1 da `[ ]` a `[x]`.
- Aggiungere data effettiva di completamento.

```bash
git add docs/plans/2026-05-04-fase-1-design.md
git commit -m "docs: slice 1 PUN-end-to-end completata"
git push
```

---

## Definition of Done — Slice 1

Slice 1 è completa quando TUTTI questi punti sono veri:

- [ ] `https://energyindex.it/it/indice/pun` carica e mostra valore PUN reale + grafico ultime 168 ore + FAQ + CTA energiapro.
- [ ] `https://energyindex.pro/...` → 301 redirige a `https://energyindex.it/...`.
- [ ] Toggle dark/light funziona e persiste in localStorage.
- [ ] `pg_cron` schedule `etl-gme-pun-daily` esiste in `cron.job` e ha status enabled.
- [ ] Almeno 1 entry in `etl_runs` con `status='ok'` e `rows_ingested=168`.
- [ ] CI verde su `main` (typecheck + test + build).
- [ ] Tag git `slice-1-ok` creato e pushato.
- [ ] Design doc Fase 1 aggiornato per riflettere completamento.

## Cosa NON si fa in Slice 1 (esplicito)

- PSV (slice 2)
- ARERA + aggregati (slice 3)
- Homepage stile borsa con ticker (slice 4)
- Mappa Italia per zone MGP (slice 5)
- Pagine SEO ausiliarie (slice 6)
- Alert email su ETL fallito (slice 7)
- Privacy policy / T&U / Umami / Playwright (slice 8)
- DST-aware timezone calculation in `etl-gme-pun` (slice 7 hardening)
- Auth su `/it/_admin/health` (v2)
