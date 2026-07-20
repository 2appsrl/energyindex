# Slice 8 — Forecast pubblico Energy Index

**Data:** 2026-05-14
**Scope:** esporre pubblicamente forecast di PUN, PSV, TTF con orizzonti 7/30/90/180 giorni, banda di confidenza, driver attribution e track record verificabile. Asset di **trust building** per il futuro EIDX Pro (sottobrand premium): i prospect Enterprise valutano qualità del modello da pagine pubbliche prima di pagare.

## 1. Obiettivo e posizionamento

Il forecast pubblico ha due funzioni:

1. **SEO + brand awareness**: query informative come "previsione PUN", "forecast gas Italia" portano traffico. Pagina `/it/forecast` dedicata posiziona il sito su keyword di intent commerciale.
2. **Trust building per EIDX Pro**: i prospect Enterprise (fornitori energy, broker, PMI energivore) decidono se pagare 149€/3.500€/mese in base alla credibilità percepita del modello. Trasparenza radicale (track record live, methodology pubblica) elimina obiezioni.

Il forecast è **deliberatamente gratis** in tier Free. I Pro/Enterprise pagano per:
- Scenari "what-if" interattivi (Modulo 2, futuro)
- Margin Simulator alimentato dal forecast (Modulo 1, Slice 9)
- Report PDF brandizzati (Modulo 3, futuro)
- API access programmatico
- Alert email su soglie

## 2. Stato attuale (verificato)

- ✅ Dati storici disponibili per training:
  - PUN: 4+ anni (giornaliero dal 2021)
  - PSV: 4+ anni (giornaliero dal 2021)
  - TTF: 7+ anni (giornaliero dal 2018)
  - Brent: 20 anni (input feature)
  - CO2: ~30 giorni (input feature, ma scarso storico)
  - Temperatura IT: 4 anni + forecast 16g Open-Meteo (input feature critica)
- ✅ Schema `assets` + `price_observations` + RPC `get_price_series` consolidato
- ✅ Pattern ETL daily via GitHub Actions
- ❌ Nessun modello di forecast in produzione
- ❌ Nessuna tabella forecast/metrics
- ❌ Nessuna pagina forecast nel sito

## 3. Algoritmo

### 3.1 Modello base

**Ridge regression** (regressione lineare con regolarizzazione L2) con feature engineering esteso. Training daily via cron, predizione istantanea. Implementato in TypeScript puro via libreria `ml-regression` (npm, 30kb) + math custom per conformal prediction.

Perché Ridge:
- Più stabile della regressione OLS quando le feature sono correlate (lag PUN e lag TTF sono correlati)
- Permette tutte le feature senza pre-selezione manuale (il regolarizzatore le pesa automaticamente)
- Coefficient interpretabili → driver attribution naturale
- Training istantaneo (<1 sec anche con 5 anni × 4 asset)

### 3.2 Feature engineering

Per ogni asset target `T ∈ {PUN, PSV, TTF}` e ogni orizzonte `h ∈ {7, 30, 90, 180}`:

**Autoregressive (storico del target stesso)**:
- `T(t-1)`, `T(t-7)`, `T(t-30)`
- `rolling_mean_7(T)`, `rolling_mean_30(T)`
- `rolling_std_30(T)` (proxy volatilità)

**Cross-asset (driver lag)**:
- `TTF(t-1)`, `TTF(t-7)` — anchor gas EU
- `Brent(t-1)` — petrolio
- `CO2(t-1)` — quota emissione
- Per modello TTF stesso: omettiamo TTF feature, aggiungiamo `PSV(t-1)` (correlazione inversa minore)

**Meteo (input critico per PUN e PSV)**:
- `HDD(t-1)`, `HDD_forecast(t+h)` — Heating Degree Days
- `CDD(t-1)`, `CDD_forecast(t+h)` — Cooling Degree Days
- `forecast(t+h)` da Open-Meteo `forecast` endpoint (16 giorni)

**Calendar**:
- `day_of_week` one-hot (7 dimensioni)
- `month` one-hot (12 dimensioni)
- `is_holiday` boolean (festività italiane via libreria `date-holidays`)
- `days_to_weekend` int

**Stagionalità ciclica**:
- `sin(2π × day_of_year / 365)`, `cos(...)` per annual cycle (evita salto 31-dic→1-gen)
- `sin(2π × day_of_week / 7)`, `cos(...)` per weekly cycle

**Totale**: ~35 feature per modello. Training su ~1.500 osservazioni (4 anni daily, weekend inclusi per PSV/TTF) → ottimo signal/noise ratio.

### 3.3 Modelli separati per orizzonte

Invece di un modello unico che predice giorno per giorno fino a `h`, addestriamo **4 modelli indipendenti** (uno per orizzonte), ognuno che predice direttamente il target `t+h`. Vantaggi:
- Più accurato a lungo termine (no error accumulation)
- Feature `HDD_forecast(t+h)` direttamente disponibile per ogni h
- Permette pesi diversi per le feature in base all'orizzonte (es. lag-1 pesa molto su 7g, poco su 180g)

### 3.4 Banda di confidenza — Conformal prediction

Per ogni modello, calcoliamo la banda 5°–95° percentile via **split conformal prediction**:

1. Sui dati di training, fare predizione con cross-validation
2. Calcolare residui `|y_real − y_predicted|` su set di calibrazione (ultimi 90 giorni)
3. La banda è `prediction ± quantile(residui, 0.9)`

**Garanzia teorica**: il valore reale cadrà dentro la banda con probabilità ~90% (distribution-free).

Implementazione: 20 righe TypeScript. Non serve assunzione gaussiana. Calibrato sul vero comportamento del modello.

### 3.5 Driver attribution

Per ogni forecast emesso, esponiamo le top 3-4 feature che hanno contribuito di più.

**Calcolo**: per ogni feature `f_i`, contribution = `coefficient_i × (f_i_today − f_i_mean_training)`.

**Output user-facing**:
```
Previsione PUN 30g: 142,3 €/MWh (banda 128,7 – 156,8)

Driver principali:
  ▲ TTF +8% vs mese scorso     +6,2 €/MWh
  ▲ Temperature -1,3°C         +4,8 €/MWh (più freddo = più consumo)
  ▼ Quota rinnovabili sopra media −3,1 €/MWh
  ▲ Calendar (mese invernale)  +2,4 €/MWh
```

Calcolato server-side ogni volta che il forecast viene generato (cached in colonna `drivers JSONB`).

## 4. Asset coperti, orizzonti, granularità

| Asset | Orizzonti | Granularità output | Periodo training |
|---|---|---|---|
| PUN | 7/30/90/180g | Daily medio | Ultimi 4 anni (2022-2026) |
| PSV | 7/30/90/180g | Daily | Ultimi 4 anni |
| TTF | 7/30/90/180g | Daily | Ultimi 7 anni (2019-2026) |

**Frequenza**:
- Training settimanale (domenica notte 03:00 UTC) — pesi modello stabili per 1 settimana
- Inferenza giornaliera (mattina 05:00 UTC) — nuovi forecast salvati ogni giorno
- Metric refresh giornaliero (mattina 06:00 UTC) — confronto forecast vs realtà

## 5. Schema DB

### 5.1 Tabella `forecasts`

```sql
CREATE TABLE forecasts (
    id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,              -- giorno per cui prevediamo
    generated_at TIMESTAMPTZ NOT NULL,        -- quando abbiamo emesso il forecast
    horizon_days INT NOT NULL,                -- 7, 30, 90, 180
    value NUMERIC(12, 4) NOT NULL,            -- previsione puntuale
    value_lower NUMERIC(12, 4),               -- banda 5° percentile
    value_upper NUMERIC(12, 4),               -- banda 95° percentile
    drivers JSONB,                            -- top 3-4: [{name, contribution_eur, direction}]
    model_version VARCHAR(20),                -- es. "ridge-v1.0"
    UNIQUE(asset_id, forecast_date, generated_at, horizon_days),
    CHECK (horizon_days IN (7, 30, 90, 180))
);
CREATE INDEX idx_forecasts_asset_horizon_date
    ON forecasts(asset_id, horizon_days, forecast_date DESC);
CREATE INDEX idx_forecasts_generated_at
    ON forecasts(generated_at DESC);
```

### 5.2 Tabella `forecast_metrics`

```sql
CREATE TABLE forecast_metrics (
    id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    horizon_days INT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    mape NUMERIC(6, 3),                       -- Mean Absolute Percentage Error
    rmse NUMERIC(12, 4),                      -- Root Mean Squared Error
    hit_ratio NUMERIC(5, 3),                  -- % indovinata direzione (up/down)
    coverage NUMERIC(5, 3),                   -- % real dentro banda 5-95%
    n_observations INT NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asset_id, horizon_days, period_start, period_end)
);
CREATE INDEX idx_metrics_asset_horizon
    ON forecast_metrics(asset_id, horizon_days, period_end DESC);
```

### 5.3 RPC `get_forecast_chart_data`

Query per UI: dato un `asset_id`, ritorna storico ultimi 1Y + forecast attuali a 4 orizzonti in unico array timeline.

```sql
CREATE OR REPLACE FUNCTION get_forecast_chart_data(
  p_asset_id BIGINT,
  p_horizon_days INT
)
RETURNS TABLE (
  date DATE,
  source TEXT,            -- 'history' | 'forecast'
  value NUMERIC,
  value_lower NUMERIC,
  value_upper NUMERIC
) LANGUAGE sql SECURITY DEFINER AS $$
  -- Storico: ultimi 365 giorni
  SELECT DATE(observed_at) AS date,
         'history' AS source,
         value, NULL::NUMERIC, NULL::NUMERIC
  FROM price_observations
  WHERE asset_id = p_asset_id
    AND observed_at >= NOW() - INTERVAL '1 year'
  UNION ALL
  -- Forecast attuali: solo quelli con generated_at più recente
  SELECT forecast_date AS date,
         'forecast' AS source,
         value, value_lower, value_upper
  FROM forecasts
  WHERE asset_id = p_asset_id
    AND horizon_days = p_horizon_days
    AND generated_at = (
      SELECT MAX(generated_at) FROM forecasts
      WHERE asset_id = p_asset_id AND horizon_days = p_horizon_days
    )
  ORDER BY date;
$$;
```

## 6. Backtesting pipeline (D — walk-forward bootstrap + rolling daily)

### 6.1 Bootstrap iniziale (1 sola volta al deploy)

Script `scripts/backfill-forecast-history.ts`:

Per ogni giorno `d` degli ultimi 12 mesi (~365 giorni):
1. Filtrare `price_observations` per simulare "dati disponibili al giorno d"
2. Training Ridge per ogni asset × orizzonte (12 modelli totali)
3. Generare forecast 7/30/90/180g
4. Salvare in `forecasts` con `generated_at = d 05:00:00 UTC`

Output: ~4.380 forecast retrospettivi popolati.

Tempo: ~10 minuti (modelli leggeri, dati già in cache).

### 6.2 Daily inference (cron GitHub Actions)

Script `scripts/run-forecast-daily.ts`, cron `0 5 * * *` (05:00 UTC):
1. Training modelli con dati disponibili fino a ieri (3 asset × 4 orizzonti = 12 modelli)
2. Generare forecast per oggi a 4 orizzonti × 3 asset = 12 forecast
3. Salvare in `forecasts`
4. Refresh MV `mv_latest_price_per_asset` (no-op se la MV non include forecast, ma in caso futuro)

### 6.3 Daily metric refresh (cron)

Script `scripts/refresh-forecast-metrics.ts`, cron `30 6 * * *` (06:30 UTC):

Per ogni `asset × horizon`:
1. Query: tutti i forecast con `generated_at + horizon_days <= today` (cioè "il momento previsto è già passato")
2. JOIN con `price_observations` per ottenere valore reale di `forecast_date`
3. Calcolare metriche aggregate per finestre ultimi 90g e ultimi 365g:
   - MAPE = `mean(|real - predicted| / real) * 100`
   - RMSE = `sqrt(mean((real - predicted)^2))`
   - hit_ratio = `mean(sign(predicted - prev_real) == sign(real - prev_real))`
   - coverage = `mean(real >= value_lower AND real <= value_upper)`
4. UPSERT in `forecast_metrics`

## 7. UX e pagine (C — mix integrato + dedicata)

### 7.1 Forecast integrato nelle pagine indice esistenti

Modifiche a `app/[locale]/indice/[slug]/page.tsx` per slug ∈ `{pun, psv, ttf}`:

Sotto la sezione chart storico esistente, **nuova sezione "Previsione"**:
- Selettore orizzonte (Tabs): `7g / 30g / 90g / 180g` (default 30g)
- Chart con linea storico ultimi 90 giorni + linea forecast estensione + area shaded (banda 5-95%)
- Sotto il chart: callout driver attribution top 3-4 con icone direction (▲▼)

Per asset esterni al gruppo `{pun,psv,ttf}` (es. brent, co2, temperatura) nessuna sezione forecast (out of scope).

### 7.2 Pagina `/it/forecast` (nuova)

Layout:
- **Hero**: titolo "Previsioni PUN, PSV, TTF — trasparenza radicale" + sottotitolo
- **3 card side-by-side** (PUN, PSV, TTF): valore forecast 30g, banda, delta vs spot, link "Vedi dettaglio"
- **Sezione Track Record** (sotto): chart "previsione vs realtà ultimi 12 mesi" con asset selector. Tabella riassuntiva MAPE/hit_ratio/coverage per ogni asset×orizzonte
- **CTA**: "Vuoi forecast a 24 mesi, scenari custom, alert email? → EIDX Pro" (preparare placeholder, link in Slice 9)
- **Footer**: link a `/it/forecast/metodologia` e disclaimer

### 7.3 Pagina `/it/forecast/track-record` (nuova)

Dashboard dettagliata, autonoma e condivisibile (URL stabile per outreach vendita):
- Chart: previsione vs realtà ultimi 12 mesi per asset selezionato + orizzonte
- Tabella: MAPE/RMSE/hit_ratio/coverage per asset × orizzonte × finestra (90g vs 12m)
- Filtri: asset (dropdown), orizzonte (tabs)

### 7.4 Pagina `/it/forecast/metodologia` (nuova)

Versione web del paper `eidx-methodology-public.md` che hai scritto:
- Porting markdown → MDX (Next.js)
- Stessi capitoli del paper
- Anchor links per sezioni
- Cita fonte ("EIDX Research, v1.0, maggio 2026")
- SEO-friendly: keyword "metodologia forecast prezzi energia", "previsione PUN modelli statistici", ecc.

## 8. SEO + JSON-LD

### 8.1 Pagina `/it/forecast`

- `<title>`: "Previsioni PUN, PSV, TTF — Energy Index"
- `<description>`: trust-focused, menziona "track record verificabile" e "metodologia trasparente"
- JSON-LD `Dataset`: forecast come dataset pubblico (`name`, `description`, `keywords`, `temporalCoverage`, `creator`, `license`)
- OG image dinamica: 3 valori forecast (PUN, PSV, TTF) con palette EIDX brand

### 8.2 Pagina `/it/forecast/metodologia`

- JSON-LD `TechArticle` (scholarly article markup)
- `headline`, `author: "EIDX Research"`, `datePublished`, `publisher: Organization (Energy Index)`
- Schema per `citation` se utile

### 8.3 Sitemap

Aggiungere a `app/sitemap.ts`:
- `/it/forecast` (priority 0.9, weekly)
- `/it/forecast/track-record` (priority 0.6, daily)
- `/it/forecast/metodologia` (priority 0.5, monthly)

### 8.4 FAQ contestuali

`content/it/faq/forecast.md` (5 domande):
1. Come funzionano le previsioni di Energy Index?
2. Quanto sono accurate? Posso fidarmi per decisioni reali?
3. Cosa significa banda di confidenza 5-95%?
4. Perché il forecast a 180 giorni è meno preciso di quello a 7 giorni?
5. Posso usare i forecast a fini commerciali / decisioni di copertura?

## 9. Files toccati

### Nuovi
- `supabase/migrations/20260514000003_forecast_tables.sql`
- `supabase/migrations/20260514000004_rpc_get_forecast_chart_data.sql`
- `lib/forecast/features.ts` — feature engineering pure functions
- `lib/forecast/model.ts` — Ridge training + prediction + conformal prediction
- `lib/forecast/attribution.ts` — driver attribution calculation
- `scripts/run-forecast-daily.ts` — daily inference cron entry
- `scripts/refresh-forecast-metrics.ts` — daily metric refresh cron entry
- `scripts/backfill-forecast-history.ts` — bootstrap walk-forward
- `.github/workflows/forecast-daily.yml` — cron daily 05:00 + 06:30 UTC
- `app/[locale]/forecast/page.tsx`
- `app/[locale]/forecast/track-record/page.tsx`
- `app/[locale]/forecast/metodologia/page.tsx` (MDX)
- `app/[locale]/forecast/opengraph-image.tsx`
- `components/forecast/ForecastChart.tsx` — chart con storico + forecast + banda
- `components/forecast/ForecastCard.tsx` — card sintetica per `/it/forecast`
- `components/forecast/DriverAttribution.tsx` — callout driver
- `components/forecast/TrackRecordTable.tsx`
- `content/it/faq/forecast.md`
- `tests/lib/forecast-features.test.ts`
- `tests/lib/forecast-model.test.ts`
- `tests/lib/forecast-attribution.test.ts`

### Modificati
- `app/[locale]/indice/[slug]/page.tsx` — sezione forecast integrata per slug pun/psv/ttf
- `app/sitemap.ts` — +3 URL
- `lib/seo/jsonld.ts` — eventuale nuovo factory `techArticle()` per metodologia

## 10. Setup operativo richiesto al user

**Zero**. Tutto interno:
- Open-Meteo già configurato (no API key)
- Supabase secret già esistenti
- GitHub Actions secret già esistenti
- Nessuna nuova dipendenza paid

L'unica cosa che serve dopo il deploy: **lanciare il backfill walk-forward 1 volta** (`scripts/backfill-forecast-history.ts`). Lo lanciamo via workflow `backfill-on-demand` esteso con target `forecast-history`.

## 11. Out of scope (rinviato esplicitamente)

- ❌ Forecast per Brent / CO2 / temperatura (ridondante, fonti migliori altrove)
- ❌ Forecast intra-day o orario (granularità minima = daily)
- ❌ Scenari "what-if" interattivi (Modulo 2 EIDX Pro, Slice 9+)
- ❌ Export CSV / API endpoint (tier Pro+)
- ❌ Alert email su soglie forecast (tier Pro+)
- ❌ Forecast PUN per zone (nord/sud/etc.) — solo PUN nazionale per ora
- ❌ Modelli Prophet/XGBoost in Python (trigger upgrade già definito separatamente)
- ❌ Ensemble di modelli multipli (Slice futura quando upgrade Python)

## 12. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Modello Ridge underperforming vs modelli ML moderni | MAPE > 12% su 90g = trigger upgrade Python (Prophet/XGBoost) |
| Banda di confidenza troppo larga (perde valore) | Conformal calibration su ultimi 90g; testing periodico coverage |
| Backfill walk-forward ha bias (data leakage) | Strict filter: per giorno `d` usare SOLO dati `observed_at < d 00:00 UTC` |
| Driver attribution forviante per modelli con feature collineari | Ridge regolarizza ma coefficient possono comunque essere fuorvianti. Mostriamo SOLO top 3-4, evitiamo ranking minore |
| Cron Daily inference fail → forecast stale | Workflow logging + email alert; fallback su forecast precedente |
| Open-Meteo forecast meteo non disponibile | Fallback: usare ultimo storico noto come proxy (degradazione graceful) |
| Coverage <85% (banda sottocalibrata) | Aggiungere safety margin: moltiplicare conformal quantile per 1.05 |
| Pagina metodologia troppo tecnica per consumer | Linguaggio italiano accessibile, glossario in fondo |

## 13. Acceptance criteria

A fine slice deve essere vero:
- [ ] DB ha tabelle `forecasts` (~4.000 record bootstrap walk-forward) e `forecast_metrics` (popolata)
- [ ] RPC `get_forecast_chart_data` funzionante
- [ ] 3 nuovi GitHub Actions workflow: training settimanale + inference daily + metric refresh daily
- [ ] Pagina `/it/forecast` accessibile con 3 asset card, 4 orizzonti, banda confidenza
- [ ] Pagine indice `/it/indice/{pun,psv,ttf}` hanno sezione forecast integrata con selettore orizzonte
- [ ] Pagina `/it/forecast/track-record` con dashboard metriche
- [ ] Pagina `/it/forecast/metodologia` pubblicata da paper esistente (MDX)
- [ ] Sitemap include 3 nuove URL
- [ ] JSON-LD Dataset valido su `/it/forecast` (Google Rich Results Test ✅)
- [ ] OG image dinamica `/it/forecast/opengraph-image` con palette EIDX brand
- [ ] FAQ `content/it/faq/forecast.md` con 5 domande
- [ ] Test suite passa con >90 test totali (era 74 + ~16 nuovi)
- [ ] Netlify deploy verde
- [ ] Coverage misurato della banda di confidenza ≥ 85% sui 90g recenti
