# PUN — Selettore timeframe + backfill storico 5Y

**Data:** 2026-05-07
**Scope:** pagina `/it/indice/pun`
**Riferimento UX:** `https://elyonzero.it/osservatorio` (default annuale, area chart)

## 1. Obiettivo

Permettere all'utente di esplorare l'andamento del PUN su orizzonti diversi
(da 24 ore a 5 anni) con un selettore preset stile Borsa. Default **5Y**
per rinforzare il posizionamento "indice di lungo periodo".

## 2. Selettore timeframe

| Pill | Range | Granularità | Punti tipici |
|------|-------|-------------|--------------|
| 5Y   | 5 anni | media mensile | 60 |
| 1Y   | 12 mesi | media giornaliera | 365 |
| 6M   | 6 mesi | media giornaliera | 180 |
| 3M   | 3 mesi | media giornaliera | 90 |
| 1M   | 30 giorni | media giornaliera | 30 |
| 1S   | 7 giorni | orario (raw) | 168 |
| 1G   | 24 ore | orario (raw) | 24 |

- Default: **5Y**
- UI: pill row sopra al chart, pill attivo `bg-primary`
- Mobile: scroll orizzontale (`overflow-x-auto`)
- Stato persistito via URL: `?tf=5Y` (SEO friendly, no JS state)
- Pulsanti = `<Link href="?tf=...">` → soft navigation, RSC refetch

## 3. Aggregazione lato DB

Una singola query parametrica per timeframe. `date_trunc()` standard Postgres,
nessun materialized view nuovo per ora (YAGNI: ~44k righe sono nulla).

```sql
-- esempio per TF=5Y, bucket=month
SELECT
  date_trunc('month', observed_at) AS bucket,
  AVG(value)::numeric AS value
FROM price_observations
WHERE asset_id = $1
  AND observed_at >= NOW() - INTERVAL '5 years'
  AND observed_at <= NOW()
GROUP BY bucket
ORDER BY bucket;
```

Per `1S`/`1G` (granularità raw) niente GROUP BY, solo `SELECT observed_at,
value`. Mapping TF→{interval, trunc_unit, raw} in `lib/timeframes.ts`.

## 4. Backfill storico

One-shot script `scripts/backfill-gme-pun.ts` (NON edge function — gira locale
con service-role-key da `.env.local`).

- Itera da `2021-05-07` a ieri (1.826 giorni)
- Per ogni data: 1 fetch nazionale + 6 zone = 7 chiamate API GME
- Sleep 150 ms tra fetch (gentile col GME)
- Riusa `bootstrapGmeDnnSession` + `parseGmePun` esistenti
- UPSERT con `onConflict: "asset_id,observed_at"` → idempotente, rilanciabile
- Log progress ogni 30 giorni
- Stima: ~30-40 min di runtime, ~307k righe (44k nazionale + 6×44k zonali)

**Esecuzione**: prima del deploy del selector, così al primo caricamento il
default 5Y mostra subito una curva ricca.

## 5. Chart

- `PriceChart` resta area chart (lightweight-charts)
- Titolo dinamico: "Andamento ultimi N anni/mesi/giorni" derivato dal TF
- Tooltip: per aggregati mostra "Media mese/giorno", per raw "Prezzo orario"
- Y-axis: invariato (€/MWh)

## 6. FAQ Q4

In `content/it/faq/pun.md`, riscrittura Q4:

```markdown
## Posso passare a una tariffa basata sul PUN?

Sì. Le offerte "variabili" indicizzate al PUN aggiungono uno spread fisso
al prezzo PUN dell'ora. In alternativa puoi scegliere tariffe a "prezzo
fisso", che bloccano il costo dell'energia per 12 o 24 mesi a prescindere
dall'andamento del mercato.
```

(Rimosso link a energiapro: la CTA grafica già copre il funnel.)

## 7. File toccati

- ➕ `lib/timeframes.ts` — mapping TF → `{from, bucket, label}`
- ➕ `components/chart/TimeframeSelector.tsx` — pill row
- ➕ `scripts/backfill-gme-pun.ts` — one-shot
- ✏️ `app/[locale]/indice/[slug]/page.tsx` — `searchParams.tf`, query bucketata
- ✏️ `components/chart/PriceChart.tsx` — titolo + tooltip dinamici
- ✏️ `content/it/faq/pun.md` — Q4

## 8. Out of scope (rimandato)

- Custom date range picker (YAGNI: i preset coprono >95% dei casi)
- Materialized view per aggregati (YAGNI: 44k righe sono nulla)
- Selettore zonale (NORD/SUD/etc.) — Slice futuro
- DST-aware backfill (riusa la simplification CEST anno-rotondo già in ETL)

## 9. Rischi

- **GME rate-limit / IP block** durante backfill: mitigazione = sleep 150ms +
  rilanciabilità idempotente. Se GME blocca, posso riprendere da ieri.
- **Asta MGP del giorno corrente vuota dopo le 12:30**: irrilevante per
  storico, gestito già nell'ETL day-to-day.
