# Energy Index — Fase 1 Design Document (MVP Italia)

**Data**: 2026-05-04
**Stato**: Approvato in brainstorming. Pronto per writing-plans della Slice 1.
**Branch base**: `main` (post `fase-0-complete`)
**Riferimenti**:
- Design generale: `docs/plans/2026-05-01-energy-index-design.md`
- Spike report: `docs/plans/2026-05-01-spike-report.md`

---

## 1. Goal

Portare Energy Index da repo "spike + design" a sito **pubblico live** su `energyindex.it`, con tutto lo scope v1 del design generale (homepage stile borsa + mappa Italia per zone MGP + 4 pagine indice/zona + 4 pagine indici Energy Index + pagine ausiliarie SEO), alimentato da 4 ETL automatici (PUN, PSV, ARERA, compute-energy-index) che girano su `pg_cron` di Supabase.

## 2. Strategia di costruzione: vertical slice

8 slice incrementali, ognuna **shippabile e visibile online** su `energyindex.it`. Ogni slice termina con `git tag slice-N-ok` + deploy Netlify produzione.

| # | Slice | Output utente | ~Giorni |
|---|---|---|---|
| 1 | **PUN end-to-end** | `/it/indice/pun` con grafico storico + valore corrente, cron PUN attivo, dominio live | 3-4 |
| 2 | **PSV end-to-end** | `/it/indice/psv` analoga, ETL PSV attivo | 1-2 |
| 3 | **Energy Index aggregati** | `/it/indice-energy-index/[fisse-luce\|variabili-luce\|fisse-gas\|variabili-gas]`, ETL ARERA + computer attivi | 2-3 |
| 4 | **Homepage stile borsa** | `/it/` con ticker scorrevole + tab Italia (placeholder mappa) + 4 card Energy Index | 2 |
| 5 | **Mappa Italia per zone MGP** | `/it/zona/[nord\|cnor\|csud\|sud\|sici\|sard]` + choropleth interattivo nella tab Italia della home | 2-3 |
| 6 | **Pagine SEO ausiliarie** | `/it/glossario`, `/it/metodologia`, `/it/about`, footer con disclaimer + 3 attribuzioni | 1 |
| 7 | **Hardening + observability** | Alert email su ETL fallito 2 gg, structured data JSON-LD, sitemap dinamica, OG image dinamiche, robots.txt, pagina `/it/_admin/health` | 1-2 |
| 8 | **Polish & launch** | Privacy policy, T&U, Umami analytics, Playwright smoke E2E, Lighthouse ≥85/95/95 | 1-2 |

**Totale**: 13-19 giorni reali → **3-5 settimane di calendario** considerando weekend e priorità tue.

**Razionale dell'ordine**:
- PUN per primo: spike-validato, schema chiaro, 1 endpoint, dati orari.
- PSV subito dopo: copia-pattern del PUN (~70% identico).
- ARERA + aggregati prima della home: definiscono il "core indice proprietario" del sito.
- Homepage prima della mappa: stabilisce il brand, mappa è "upgrade" della tab Italia.
- Mappa quarta: dipendenza geo/leaflet isolata.
- SEO/Hardening/Polish in coda perché richiedono che tutto il backend sia pronto.

**Out of scope Fase 1** (rinviato a Fase 2/3):
- Mappa Europa + paesi EU (Fase 2 con ENTSO-E).
- Traduzioni EN/DE/FR (struttura i18n c'è ma solo italiano attivo).
- Backup automatici Supabase (richiede Pro $25/mese).
- Pagina admin con auth (basta security-by-obscurity in v1).

## 3. Stack & struttura del repo

### Scaffold iniziale (slice 1)

```bash
npx create-next-app@latest energyindex --typescript --tailwind --app --eslint --src-dir=false
# Aggiungi: next-intl, @supabase/supabase-js, @supabase/ssr,
#          lightweight-charts, framer-motion
# shadcn/ui CLI: npx shadcn-ui@latest init
# Init Supabase: supabase init
```

### Struttura post-scaffold

```
energyindex/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Homepage (slice 4)
│   │   └── indice/[slug]/page.tsx    # /it/indice/pun (slice 1), psv (slice 2)
│   ├── globals.css                   # Tailwind directives
│   ├── sitemap.ts                    # slice 7
│   └── robots.ts                     # slice 7
├── components/
│   ├── ui/                           # shadcn primitives
│   ├── chart/                        # PriceChart (lightweight-charts wrapper)
│   ├── ticker/                       # slice 4
│   └── theme-toggle.tsx
├── lib/
│   ├── supabase/                     # client browser + server SSR
│   ├── format/                       # €/MWh, %, date IT
│   └── i18n/                         # next-intl config
├── content/it/                       # markdown FAQ, glossario, metodologia
├── public/
│   └── geojson/                      # zone MGP (slice 5)
├── supabase/
│   ├── migrations/                   # SQL versioned, una per slice/concern
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── parsers/              # gme-pun.ts, gme-psv.ts, arera-offers.ts (PROMOSSI da spikes/)
│   │   │   ├── gme-dnn.ts            # bootstrap session
│   │   │   ├── db.ts                 # supabase service-role client
│   │   │   └── etl-runner.ts         # wrapper bookkeeping etl_runs
│   │   ├── etl-gme-pun/              # slice 1
│   │   ├── etl-gme-psv/              # slice 2
│   │   ├── etl-arera-offers/         # slice 3
│   │   ├── compute-energy-index/     # slice 3
│   │   └── refresh-views/            # slice 1
│   ├── deno.json                     # import map: "zod" → "npm:zod@^3.22"
│   └── seed.sql
├── spikes/                           # MANTENUTO — riferimento + tool rerun
├── tests/parsers/                    # Vitest, importa da supabase/functions/_shared/parsers/
├── e2e/                              # Playwright (slice 8)
└── netlify.toml
```

### Decisione architetturale: parser SINGLE SOURCE

I parser puri (`gme-pun`, `gme-psv`, `arera-offers`) vivono in `supabase/functions/_shared/parsers/`. Sia Vitest (Node) che Edge Functions (Deno) li importano da lì. Trick: `deno.json` mappa `"zod"` → `"npm:zod@^3.22.0"`, così la stessa riga `import { z } from "zod"` funziona in entrambi i runtime. Stesso codice, zero duplicazione, una sola suite test.

### Spike code mantenuto

`spikes/` resta nel repo come (a) tool per rigenerare fixture, (b) documentazione viva del comportamento delle fonti, (c) emergency tool se un ETL rompe in produzione. Non è codice di produzione.

## 4. Schema dati v1 (migrazioni Supabase)

### Migrazioni in slice 1

```
supabase/migrations/
├── 20260505_001_schema.sql                # 6 tabelle + indexes + RLS policies
├── 20260505_002_seed_geography.sql        # EU > IT > 6 zone MGP
├── 20260505_003_seed_assets_pun.sql       # 7 assets: pun + 6 zonali
├── 20260505_004_mv_latest_price.sql       # materialized view + funzione refresh
└── 20260505_005_pg_cron_etl_pun.sql       # schedule daily 13:00 Europe/Rome
```

### Migrazioni nelle slice successive

- Slice 2: `seed_assets_psv` + `pg_cron_etl_psv`.
- Slice 3: `seed_assets_arera_aggregates` + `pg_cron_etl_arera` (weekly Mon 06:00 UTC) + `pg_cron_compute_energy_index` (daily 04:00).
- Slice 5: nessuna migrazione nuova (zone già seeded in slice 1).
- Slice 7: aggiunge funzione `notify_on_etl_failure()` triggerata da update di `etl_runs`.

### Schema (riferimento dettagliato in design doc generale sez. 6)

6 tabelle: `geography`, `assets`, `price_observations`, `arera_offers`, `energy_index_aggregates`, `etl_runs`. Più 1 materialized view: `mv_latest_price_per_asset`.

### Punti tecnici critici slice 1

- **RLS attivo da subito**. Lettura pubblica anonima su `assets`, `geography`, `price_observations`, `mv_latest_price_per_asset` (e in slice 3, `energy_index_aggregates`). Scrittura solo via `service_role`.
- **Index critico**: `price_observations(asset_id, observed_at DESC)` per query grafici e latest value.
- **Constraint `UNIQUE (asset_id, observed_at)`** su `price_observations` per UPSERT idempotente cron-safe.
- **`pg_cron` timezone** impostata a `Europe/Rome` nella migrazione 001 → schedule leggibili in ora italiana.
- **`pg_cron` invoca Edge Function** via `net.http_post()` con `service_role_key` da `current_setting('supabase.service_role_key')`. Pattern ufficiale Supabase, niente endpoint esterni esposti.
- **Volumi**: PUN 168 righe/giorno × 7 zone = ~62k righe/anno. Nessun partitioning v1.

## 5. Pattern dello slice (template riusato)

### A. Edge Function `etl-gme-pun` (Deno)

6 step orchestrati da `runEtl(name, fn)`:

1. Bootstrap DNN session (helper `gme-dnn.ts` riusato dalla Fase 0).
2. Fetch dati per oggi, fallback yesterday se vuoto.
3. Parse via parser puro condiviso (`parsers/gme-pun.ts`).
4. UPSERT in `price_observations` (`onConflict: "asset_id,observed_at"`).
5. Refresh `mv_latest_price_per_asset` via funzione Postgres.
6. Return `{rows_ingested}` per logging in `etl_runs`.

### B. `etl-runner.ts` — wrapper unificato

Si occupa di:
- INSERT in `etl_runs` (`started_at`, `status='running'`).
- `try { await fn(logger) } catch errore` → `status='error'`, `error_message`, exit 500.
- Successo → UPDATE `etl_runs` (`finished_at`, `status='ok'`, `rows_ingested`).
- Retry con backoff esponenziale (10s, 60s, 300s) per errori di rete.
- Logging strutturato visibile in Supabase Dashboard.

Ogni nuovo ETL si scrive in 3 righe di orchestrazione invece di 30.

### C. Frontend Server Component

```typescript
// app/[locale]/indice/[slug]/page.tsx
export const revalidate = 3600;  // ISR ogni ora

export default async function IndicePage({ params }) {
  const supabase = createServerClient();
  const { data: latest } = await supabase
    .from("mv_latest_price_per_asset").select("*")
    .eq("asset_slug", params.slug).single();
  const { data: history } = await supabase
    .from("price_observations").select("observed_at, value")
    .eq("asset_id", latest.asset_id)
    .gte("observed_at", oneWeekAgo())
    .order("observed_at", { ascending: true });
  return (
    <main>
      <LatestValueCard latest={latest} />
      <PriceChart points={history} unit="€/MWh" />
      <FaqSection slug={params.slug} />
      <CtaToEnergiapro campaign={params.slug} />
    </main>
  );
}
```

- Server Component → query Supabase server-side, HTML completo al primo paint, LCP ottimo.
- ISR `revalidate=3600` → CDN serve per 1h, poi rigenera al primo visitor.
- Trigger di rigenerazione anticipato post-ETL via webhook → slice 7.

### D. `<PriceChart>` (client component)

Wrapper React su `lightweight-charts`. ~80 righe. Gestisce dark/light theme via CSS vars, tabular-nums, area chart con gradiente verde/rosso.

### E. Setup ambiente

- **Secrets Supabase**: `service_role` injectata automaticamente nelle Edge Functions.
- **Secrets Netlify** (frontend): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Pubbliche (RLS attivo).
- **Local dev**: `.env.local` ignorato, template in `.env.example`.

### F. Deploy flow

1. Push branch → **Netlify deploy preview** automatico.
2. Tu apri preview, dai feedback.
3. Merge in `main` → produzione live.
4. **Migrazioni Supabase** applicate via `supabase db push` in GitHub Actions (`deploy-db.yml`) prima del deploy frontend.
5. **Preview Supabase**: progetto branch dedicato per ogni PR (Supabase Branches).

### G. Testing slice 1

- **Unit (Vitest)**: parser `parseGmePun` (test esistenti dalla Fase 0).
- **Manuale prima deploy**: `supabase functions serve` localmente.
- **E2E (Playwright)**: rinviato a slice 8.

## 6. Operational concerns

### Branch strategy

Una branch per slice: `feature/slice-N-*`. Subagent-driven-development con spec + code quality review per ogni task. Merge `--no-ff` su `main` con tag `slice-N-ok`. `main` sempre deployabile.

### Observability ETL

- `etl_runs` tabella con timestamp/status/rows/error per ogni run.
- Pagina nascosta `/it/_admin/health` (no SEO, no auth in v1, security-by-obscurity) con ultime 20 run. Hardening con auth in v2.
- Alert email a `commerciale@deagroup.biz` via Resend (free tier 3k email/mese) **solo a 2° fallimento consecutivo** per evitare rumore. Configurato in slice 7.

### Backup & DR

Supabase free tier non ha backup automatici. **Accettato in v1**: i dati sono ricostruibili rilanciando ETL (GME e ARERA hanno storico). In v2 valutare Supabase Pro ($25/mese) per backup auto + branching avanzato.

### Privacy & compliance

- **Umami analytics** self-hosted (gratuito), niente cookie banner necessario.
- Privacy policy + termini d'uso boilerplate in slice 8.
- Footer con disclaimer + 3 attribuzioni:
  - GME: *"Fonte: GME — Gestore dei Mercati Energetici"*.
  - ARERA: *"Fonte: Portale Offerte — Acquirente Unico S.p.A. — ARERA"*.
  - ENTSO-E: *"Source: ENTSO-E Transparency Platform"* + link (placeholder per Fase 2).

### Domini & DNS

Dal giorno 1 di slice 1: CNAME `energyindex.it → cname.netlify.com`, redirect rule per `.pro → .it`. SSL auto Let's Encrypt via Netlify.

### CI

`.github/workflows/`:
- `ci.yml` — su ogni PR: `npm install` + `tsc --noEmit` + `npm test`. Bocca merge se rosso.
- `deploy-db.yml` — su push a `main`: `supabase db push` per migrazioni.
- Frontend deploy: gestito da Netlify auto-integration.

## 7. Definition of Done v1

### Tecnico
- [ ] 8 slice mergiate su `main` con tag `slice-N-ok`.
- [ ] `energyindex.it` + `energyindex.pro` (301) live con SSL.
- [ ] 4 ETL produttivi via `pg_cron`: PUN daily 13:00, PSV daily 17:00, ARERA weekly lunedì 06:00 UTC, compute-energy-index daily 04:00.
- [ ] `mv_latest_price_per_asset` refreshata in coda a ogni ETL.
- [ ] Nessuna entry rossa in `etl_runs` da ≥7 giorni consecutivi.
- [ ] 3 smoke E2E Playwright passano.
- [ ] Lighthouse ≥85 Performance, ≥95 Accessibility, ≥95 SEO sulle 3 pagine principali.

### Funzionale
- [ ] Homepage con ticker + tab Italia (mappa zonale) + 4 card Energy Index.
- [ ] 2 pagine indice: `/it/indice/pun`, `/it/indice/psv`.
- [ ] 6 pagine zonali: `/it/zona/[nord|cnor|csud|sud|sici|sard]`.
- [ ] 4 pagine indici proprietari: `/it/indice-energy-index/[fisse-luce|variabili-luce|fisse-gas|variabili-gas]`.
- [ ] 3 pagine ausiliarie: `/it/glossario`, `/it/metodologia`, `/it/about`.
- [ ] CTA verso energiapro.biz su 4 punti.
- [ ] Toggle dark/light con preferenza persistente.

### Compliance & legale
- [ ] Footer disclaimer + 3 attribuzioni.
- [ ] Privacy policy + termini d'uso pubblicate.
- [ ] Umami installato.
- [ ] T&C GME chiariti via mail con loro (azione utente, non bloccante per slice tecniche).

### Operational
- [ ] `/it/_admin/health` mostra ultimi run ETL.
- [ ] Alert email su 2° fallimento consecutivo.
- [ ] CI verde su `main`.

## 8. Decisioni-chiave (riepilogo)

| Area | Decisione |
|---|---|
| Strategia | Vertical slice, ship ogni 2-3 giorni |
| Slice order | PUN → PSV → ARERA+aggregati → Homepage → Mappa → SEO → Hardening → Polish |
| Stack | Next.js (App Router) + TS, Supabase (Postgres + Edge Functions Deno + pg_cron), Netlify hosting |
| UI | Tailwind + shadcn/ui, dark default + toggle, lightweight-charts, framer-motion ticker, react-leaflet (slice 5) |
| Parser | Single source in `supabase/functions/_shared/parsers/`, importati da test Node e da Edge Functions Deno |
| i18n | next-intl + URL `/it/...`, monolingua in v1, ready per v2 |
| Analytics | Umami self-hosted (gratis, niente cookie banner) |
| Domini | `energyindex.it` canonical, `energyindex.pro` 301 → .it |
| ETL | Supabase Edge Functions schedulate via pg_cron, etl-runner.ts unificato |
| Observability | tabella `etl_runs`, pagina `/it/_admin/health` no-auth, alert email Resend a 2° fallimento |
| Schema | 6 tabelle in slice 1, seed/cron incrementali per slice |
| Branching | feature/slice-N-* + tag `slice-N-ok` per slice |

## 9. Open items che restano (non bloccanti per partire)

- **Logo / brand identity**: wordmark testuale al lancio (slice 1), logo grafico dopo.
- **T&C GME** per uso commerciale dello scraping DNN dei prezzi MGP — verifica formale via mail/PEC con GME (utente). Bloccante per launch pubblico, non per slice 1-7.
- **Resend API key** per alert email (slice 7) — gratuita, registrazione utente.
- **Umami self-host**: decidere se hosting su Supabase, su una Netlify Function, o su un VPS separato. Decisione in slice 8.
