# Slice 2 — PSV/Gas end-to-end

**Data:** 2026-05-11
**Scope:** seconda commodity (gas wholesale), pipeline analoga al PUN, card sulla home.

## 1. Obiettivo

Replicare l'esperienza utente del PUN per il PSV (Punto di Scambio Virtuale, hub gas nazionale italiano), riusando l'infrastruttura DB + UI di Slice 1.5. Risultato: card "Analisi prezzi Gas" sulla home + pagina `/it/indice/psv` con stesso selector 7-pill.

## 2. Stato attuale (verificato)

- ✅ Spike `spikes/gme-psv.ts` con endpoint identificato: `GET /DesktopModules/GmeEsitiMGAS/API/item/GetGasEsitiMGAS?DataSessione=…&Mercato=MGP`
- ✅ Test parser `tests/parsers/gme-psv.test.ts` con fixture validate
- ❌ Parser runtime, edge function ETL, asset row, pg_cron schedule, pagina, card home: tutto da costruire

## 3. Differenze chiave PSV vs PUN

| Aspetto | PUN | PSV |
|---|---|---|
| Granularità | oraria (24/giorno) | giornaliera (1/giorno) |
| Numero serie | 7 (nazionale + 6 zone) | 1 |
| Sessione GME chiude | ~12:30 CEST | ~17:00 CEST |
| Endpoint modulo DNN | `GmeEsitiPrezziME` | `GmeEsitiMGAS` |
| Payload | `data, ora, prezzo` per ogni ora | 1 riga per prodotto (MGP-YYYY-MM-DD) |
| Campo prezzo | `prezzo` | `prezzoRiferimento` |

Definizione canonica del "prezzo PSV daily": per la sessione di trading T, prezzo PSV per data consegna T+1 = riga con `prodotto = "MGP-T+1"`, campo `prezzoRiferimento`. Documentato già nello spike.

## 4. Selector timeframe per dato giornaliero

Pill identici al PUN (consistenza UI assoluta — utente impara una volta):

| Pill | Range | Bucket PSV (daily source) | Punti tipici |
|---|---|---|---|
| 5Y | 5 anni | monthly | 60 |
| 1Y | 12 mesi | weekly | 52 |
| 6M | 6 mesi | daily raw | 180 |
| 3M | 3 mesi | daily raw | 90 |
| 1M | 30 giorni | daily raw | 30 |
| 1S | 7 giorni | daily raw | 7 |
| 1G | 1 giorno | daily raw | 1 (degenere ma coerente UI) |

Implementazione: `lib/timeframes.ts` aggiunge un secondo bucket per ogni TF (per source-granularity), e `resolveTimeframe(input, sourceGranularity)` sceglie quale usare. La RPC supporta anche `week` come bucket.

## 5. Backfill storico

Specchio del PUN: range `2021-05-11 → ieri` (5 anni). Stima ~1.825 giorni × 1 fetch = 1.825 chiamate API, sleep 500ms, totale ~15-20 min (5x meno del PUN perché 1 serie sola).

Script `scripts/backfill-gme-psv.ts` con la stessa resilience (retry, session refresh, env-driven START/END).

## 6. Generalizzazione RPC

`get_pun_series` → `get_price_series` (asset-agnostic). Il body è già generico (accetta `p_asset_id`), solo il nome è specifico. Migration:

```sql
-- Drop il vecchio
DROP FUNCTION IF EXISTS get_pun_series(BIGINT, TEXT, TEXT);
-- Crea il nuovo con stesso body, +supporto bucket='week'
CREATE OR REPLACE FUNCTION get_price_series(
  p_asset_id BIGINT, p_interval TEXT, p_bucket TEXT
) RETURNS TABLE(observed_at TIMESTAMPTZ, value NUMERIC)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_bucket = 'raw' THEN ...
  ELSIF p_bucket IN ('day','week','month') THEN
    RETURN QUERY EXECUTE format(
      'SELECT date_trunc(%L, observed_at) ... ', p_bucket, p_interval
    ) USING p_asset_id;
  ELSE RAISE EXCEPTION 'invalid bucket: %', p_bucket;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION get_price_series(BIGINT, TEXT, TEXT) TO anon;
```

`app/[locale]/indice/[slug]/page.tsx` aggiorna `.rpc("get_pun_series", ...)` → `.rpc("get_price_series", ...)`.

## 7. ETL day-to-day

Edge function `supabase/functions/etl-gme-psv/index.ts`, schema simile a `etl-gme-pun`:
- Bootstrap DNN session
- Fetch `GetGasEsitiMGAS` con `DataSessione=YYYYMMDD` (sessione di ieri o oggi)
- Estrae riga con `prodotto = MGP-T+1`
- Upsert in `price_observations` con `granularity = 'daily'`, `observed_at = T+1 midnight Europe/Rome`
- Refresh MV

pg_cron schedule: ogni giorno alle **18:00 Europe/Rome** (dopo chiusura sessione gas ~17:00).

## 8. Home page — card grafiche live

Le due card sulla home diventano **mini-vetrine prezzo live**, minimal text:

```
┌────────────────────────────────────────┐
│  ⚡                              ▼ 5.8% │
│                                         │
│   Energia Elettrica                     │
│                                         │
│   146,42 €/MWh                          │
└────────────────────────────────────────┘
```

Specifiche:
- Card alta (~h-72 desktop, ~h-56 mobile), gradient primary
- Icona grossa top-left in cerchio primary: Zap (luce) / Flame (gas), ~48px
- Delta % live top-right: verde se ≥0, rosso se <0
- Titolo 2-3 parole (text-3xl/4xl): "Energia Elettrica" / "Gas"
- Prezzo XXL (text-4xl/5xl tabular-nums) sotto titolo
- **Niente descrizione**, niente CTA esplicito — tutta la card è cliccabile (hover lift)
- Layout: `grid gap-6 sm:grid-cols-2`
- "Powered by EnergiaPro" rimosso dalla card home; resta sulla CTA dentro le pagine indice

Server-side data fetch nella home: query unica su `mv_latest_price_per_asset` con `.in("asset_slug", ["pun", "psv"])`. Per il delta serve anche la rilevazione precedente — query secondaria su `price_observations` con `limit(1)` per ciascun asset, oppure tenere il delta nella MV come campo precomputato (out of scope: usiamo 2 query mirate, una per asset, in `Promise.all`).

Stato "dati in arrivo" per PSV finché backfill non ha popolato: se l'asset PSV esiste ma `latest_price` è null, mostriamo card vuota grigia "Dati in arrivo" invece del prezzo.

| Card | Icona | Slug | Stato iniziale |
|---|---|---|---|
| Energia Elettrica | Zap | `pun` | popolata (Slice 1.5) |
| Gas | Flame | `psv` | "Dati in arrivo" finché ETL non gira la prima volta |

## 9. FAQ PSV

Nuovo `content/it/faq/psv.md` con 4 Q&A:
1. Cos'è il PSV?
2. Quando viene aggiornato?
3. Perché il prezzo PSV influisce sulla bolletta gas?
4. Posso passare a una tariffa basata sul PSV?

## 10. Files toccati

**Nuovi**:
- `supabase/functions/_shared/parsers/gme-psv.ts` (parser runtime, estratto da spike)
- `supabase/functions/etl-gme-psv/index.ts`
- `supabase/migrations/20260511000000_seed_asset_psv.sql`
- `supabase/migrations/20260511000001_rpc_get_price_series.sql` (rinomina + aggiunge week)
- `supabase/migrations/20260511000002_pg_cron_etl_psv.sql`
- `scripts/backfill-gme-psv.ts`
- `content/it/faq/psv.md`
- `tests/lib/timeframes.test.ts` (estensione per source-granularity)

**Modificati**:
- `lib/timeframes.ts` (bucket awareness per source granularity)
- `app/[locale]/indice/[slug]/page.tsx` (supporta slug='psv', RPC name updated, passa granularity)
- `app/[locale]/page.tsx` (home: aggiunge card gas + grid layout)
- `supabase/functions/etl-gme-pun/index.ts` se serve aggiornare slug check (improbabile)

## 11. Out of scope (rinviato)

- Selettore zonale PUN (Slice futura)
- Confronto incrociato luce/gas in un unico chart
- Custom date range picker
- DST-aware backfill
- i18n inglese

## 12. Rischi

- **PSV ha storico più recente o gap**: l'API potrebbe non avere dati pre-2021. Mitigazione: il backfill è idempotente — se un giorno restituisce vuoto, lo skippa (già implementato per PUN).
- **Schedule ETL conflittuale**: pg_cron alle 18:00 mentre PUN gira alle 12:30. Nessun conflitto di lock (asset_id diversi).
- **Doppia card mobile**: stack verticale su mobile con `sm:grid-cols-2` → su mobile diventa 2 card stack, totale viewport ~600px. Accettabile.
