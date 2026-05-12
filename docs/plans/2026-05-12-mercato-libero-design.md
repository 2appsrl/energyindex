# Slice 4 — Mercato Libero ARERA (Osservatorio statistico)

**Data:** 2026-05-12
**Scope (Fase 1):** osservatorio statistico delle offerte PLACET (luce + gas, fisse + variabili) sulla pagina `/it/mercato-libero` + banner promo sulla home.
**Fase 2 (futura slice):** pagina ticker Bloomberg-style `/it/mercato-libero/ticker` con tutte le offerte scorrevoli + colorate rispetto al PUN.

## 1. Obiettivo

Mostrare all'utente "quanto costa l'energia oggi sul mercato libero" senza sostituirci al comparatore EnergiaPro. 4 aggregati statistici (luce-fissa, luce-variabile, gas-fissa, gas-variabile) con mediana + percentili + spread vs PUN/PSV, chart trend mediana 1Y, CTA finale a EnergiaPro.

## 2. Stato attuale (verificato)

- ✅ Spike `spikes/arera-offers.ts` con URL pattern + parser PLACET luce/gas + helper `statsFor` (min/p25/median/p75/max)
- ✅ Test `tests/parsers/arera-offers.test.ts` su fixture committed
- ✅ Schema DB: `arera_offers` (0 righe) + `energy_index_aggregates` (0 righe)
- ❌ Da fare: parser runtime, ETL, pg_cron, backfill 1Y, page UI, home banner

## 3. Architettura dati

### 3.1 `arera_offers` (esistente)
Holds raw rows da CSV PLACET. Una riga = un'offerta. Schema già definito:
```
id, offer_code, supplier, commodity, price_type ('fisso'|'variabile'),
price_value, valid_from, valid_to, raw (JSONB), recorded_at
```

L'ETL:
- Scarica CSV del giorno T
- Per ogni riga, fa **UPSERT** su `(offer_code, valid_from)` (UNIQUE constraint da aggiungere)
- `valid_to` = data fine offerta dal CSV (può essere NULL = aperta)

### 3.2 `energy_index_aggregates` (esistente, riusato)
Holds aggregati daily computati post-ETL. Schema:
```
id, aggregate_slug, computed_at (date), median, p25, p75, min, max,
sample_size, spread_vs_reference_pct, unit, created_at
```

4 `aggregate_slug` Slice 4:
- `mercato-libero-luce-fissa` — unit €/kWh, riferimento PUN
- `mercato-libero-luce-variabile` — unit €/kWh (alpha), riferimento PUN
- `mercato-libero-gas-fissa` — unit €/Smc, riferimento PSV (€/Smc derivato)
- `mercato-libero-gas-variabile` — unit €/Smc (alpha), riferimento PSV

`spread_vs_reference_pct` = (median offerta − reference wholesale) / reference × 100. Reference convertito alla stessa unit dell'offerta (€/kWh per luce, €/Smc per gas).

NB: PUN è €/MWh wholesale; offerta retail è €/kWh — conversione: `PUN / 1000`. PSV è €/MWh; offerta gas è €/Smc — conversione: `PSV × fattore_smc_mwh` (tipicamente 0.0394 Smc/kWh × 1000 = ~10.55 €/MWh = X €/Smc, vedi tabella conversione standard).

## 4. ETL daily (`etl-arera-placet`)

Edge function Deno mirror del pattern PUN/PSV.

Workflow:
1. Calcola data T = oggi (Europe/Rome)
2. Scarica i 2 CSV PLACET: `PO_Offerte_E_PLACET_<YYYYMMDD>.csv` + `PO_Offerte_G_PLACET_<YYYYMMDD>.csv` (URL pattern già nello spike)
3. Parse via `parsePlacetElectric` + `parsePlacetGas` (shared parser, single source of truth)
4. UPSERT righe in `arera_offers` con `onConflict: 'offer_code,valid_from'`
5. Computa 4 aggregati statistici per T → INSERT in `energy_index_aggregates`
6. Refresh MV se necessario (nessuna MV cross-arera al momento)

pg_cron schedule: `0 0 * * *` UTC (= 01:00 CET / 02:00 CEST) — sicuro dopo refresh ARERA ~22:30 UTC.

Fallback: se CSV oggi 404 (ARERA non ha ancora pubblicato), riprova ieri. Stesso pattern PUN/PSV.

## 5. Backfill 1Y

Script `scripts/backfill-arera-placet.ts`, env-driven START/END/SLEEP (pattern PUN/PSV).
- Range: ultimi 365 giorni
- 2 fetch/giorno (E + G CSV)
- Sleep 500ms tra fetch
- ETA: ~365 × 2 × ~700ms = ~8 min
- Idempotente via UPSERT
- Computa aggregati post-loop (1 query SQL aggrega `arera_offers` per data → INSERT in `energy_index_aggregates`)

## 6. Pagina `/it/mercato-libero`

Layout:
```
[Header "Mercato Libero — Offerte ARERA"]
[Descrizione 1 paragrafo]

[Grid 2x2 di card aggregato]
  [Luce Fissa]      [Luce Variabile]
   €/kWh mediano     spread medio €/kWh
   p25 / p75         vs PUN
   n. offerte        n. offerte

  [Gas Fissa]       [Gas Variabile]
   €/Smc mediano     spread medio €/Smc
   p25 / p75         vs PSV
   n. offerte        n. offerte

[Chart "Trend mediana ultimi 12 mesi"]
  — 4 serie sovrapposte (luce-fissa, luce-var, gas-fissa, gas-var)
  — toggle/legenda per show/hide
  
[CTA banner "Vai al comparatore EnergiaPro"]
[FAQ "Mercato libero — Domande frequenti"]
```

Server-side fetch: ultima riga di `energy_index_aggregates` per ognuno dei 4 slug + serie 365 giorni per il chart.

## 7. Home page — banner promo

Sotto le 2 card "Energia Elettrica" / "Gas" attuali, aggiunge una **terza card large full-width**:

```
[ICON 🛒 in cerchio primary] | Mercato Libero
                              | Offerta mediana luce variabile: 0,12 €/kWh (-3% vs PUN nazionale)
                              | Confronta 400+ offerte ARERA →
```

Click → `/it/mercato-libero`. Stessa estetica delle card wholesale (gradient primary, hover lift). Si differenzia per: icona diversa (ShoppingCart o LineChart o Sparkles), layout orizzontale (full-width invece di 1/2), una statistica chiave invece di prezzo+delta.

## 8. FAQ `/it/mercato-libero`

Nuovo `content/it/faq/mercato-libero.md` con 4 Q&A:
1. Cos'è il mercato libero?
2. Cosa sono le offerte PLACET?
3. Come faccio a scegliere tra prezzo fisso e variabile?
4. Da dove vengono i dati?

## 9. Files toccati

**Nuovi**:
- `supabase/functions/_shared/parsers/arera-placet.ts` (estratto da spike, single source of truth)
- `supabase/functions/etl-arera-placet/index.ts`
- `supabase/migrations/20260512000000_arera_offers_unique.sql` (UNIQUE constraint per UPSERT)
- `supabase/migrations/20260512000001_pg_cron_etl_arera.sql` (doc-only, schedule applicato via MCP)
- `scripts/backfill-arera-placet.ts`
- `lib/arera-aggregates.ts` — type `AggregateSlug` + display labels
- `app/[locale]/mercato-libero/page.tsx`
- `components/mercato-libero/AggregateCard.tsx` (mini-card stat)
- `components/mercato-libero/AggregateTrendChart.tsx` (lightweight-charts, 4 serie)
- `components/home/MarketBanner.tsx` (banner home sotto le 2 card)
- `content/it/faq/mercato-libero.md`

**Modificati**:
- `app/[locale]/page.tsx` — aggiunge `<MarketBanner />` sotto la grid
- `tests/parsers/arera-offers.test.ts` — aggiorna import al nuovo path shared

## 10. Out of scope (rinviato a Fase 2 / future slice)

- **Pagina ticker Bloomberg-style** `/it/mercato-libero/ticker` (Fase 2)
- Filtri vendor/regione
- Mercato Libero XML (MLIBERO, non PLACET)
- Simulazione su consumo annuo personalizzato (compete con energiapro)
- Mappa territoriale offerte

## 11. Rischi

- **Conversione PSV → €/Smc**: il fattore di conversione 1 Smc gas naturale ≈ 10.55 kWh termici è uno standard ARERA — uso quello, ma con commento nel codice.
- **`spread_vs_reference_pct` per offerte variabili**: lo spread alpha è già la quantità rilevante (€/kWh aggiunto al PUN). Il "spread vs reference" diventa quindi alpha stesso, non un calcolo. Distinzione necessaria in code.
- **ARERA cambia schema CSV**: tornano `n_campi != 26` o 21. Il parser `parsePlacetGeneric` ha sanity check + throw — l'ETL si auto-segnala via `etl_runs.status='error'`.
- **CSV gigante**: alcuni giorni hanno >1000 offerte. Cumulativo 365 × ~800 = ~300k righe in `arera_offers`. Postgres mangia in un boccone.
- **Aggregati duplicati post-backfill**: la INSERT su `energy_index_aggregates` usa UNIQUE `(aggregate_slug, computed_at)` (già nello schema). UPSERT-safe.
