# Energy Index — Design Document

**Data**: 2026-05-01
**Stato**: Approvato in brainstorming. Pronto per Fase 0 (spike fonti dati).
**Aggiornato 2026-05-04** in seguito alle scoperte della Fase 0 (vedi `docs/plans/2026-05-01-spike-report.md`).
**Owner**: DEA Group (commerciale@deagroup.biz)

---

## 1. Vision

Energy Index è un sito pubblico, gratuito, in stile "borsa" (NASDAQ-like) che mostra in modo trasparente i prezzi del mercato luce e gas residenziale. Il pilota copre Italia ed Europa, con roadmap verso scope mondiale.

Il sito **non è un comparatore**: è un osservatorio prezzi. La conversione commerciale (confronto tariffe → cambio fornitore → lead) avviene su [energiapro.biz](https://energiapro.biz), comparatore già esistente dell'owner. Energy Index funziona da top-of-funnel SEO/brand authority che incanala traffico verso energiapro.biz.

## 2. Posizionamento

- **Vetrina informativa pubblica e gratuita**, non lead generator diretto.
- **Fonti solo ufficiali / governative** per credibilità: GME, ARERA, ENTSO-E.
- **Indice proprietario** ("Energy Index · Fisse Luce/Gas", "Variabili Luce/Gas") calcolato su dati ARERA, citabile da PR/giornalisti.
- **CTA distribuiti** verso energiapro.biz con UTM tracking. Nessun form di lead su Energy Index stesso.

## 3. Modello di aggiornamento dati

**Decisione: aggiornamento giornaliero reale con effetto visivo "borsa"** (animazioni, sparkline, ticker scorrevole, frecce verde/rosso). Sotto, i dati si aggiornano:

- **PUN**: ~12:30 ora italiana, 24 valori orari per il giorno successivo (esiti asta MGP del giorno corrente).
- **PSV**: fine giornata, 1 valore giornaliero.
- **ENTSO-E day-ahead** paesi EU: ~14:00 ora italiana.
- **ARERA Portale Offerte**: settimanale (lunedì notte).
- **Energy Index aggregati**: ricomputati ogni notte alle 04:00.

Niente feed a pagamento. Niente dati intraday tick-by-tick (non esistono per questi mercati pubblicamente).

**Note operative sulla disponibilità**:
- **PSV**: il mercato gas opera 7/7, niente buchi su weekend e festivi.
- **PUN**: l'asta MGP non gira sui festivi (es. 1° maggio, 25 dicembre) → niente prezzo per consegna del giorno dopo a quei giorni. Riflesso nella UI come stato "sessione non disponibile" senza allarme.
- **ENTSO-E day-ahead**: dal 2025 la granularità ufficiale è **PT15M** (96 punti/giorno per zona) anziché PT60M (24 punti). DST e curveType=A03 (sparse points) richiedono espansione in serie densa nell'ETL.

## 4. Scope

### v1 (MVP) — Europa
- **Italia ricca**: PUN nazionale + 6 zone MGP (Nord, Centro-Nord, Centro-Sud, Sud, Sicilia, Sardegna), PSV gas, 4 indici Energy Index aggregati.
- **Paesi EU "leggeri"**: day-ahead price ENTSO-E per ~15-20 paesi europei principali.
- **Mappa** Italia (zone) + Europa (paesi).

**Nota PUN (post-2025)**: dal 1° gennaio 2025 il PUN è stato ridefinito come **PUN Index GME** — media ponderata sui volumi di mercato, NON più la media aritmetica zonale precedente. Da menzionare nelle pagine `/it/indice/pun` e `/it/metodologia` per accuratezza didattica.

### v2 — Espansione internazionale
- Resto del mondo "leggero" via Eurostat / IEA / Global Petrol Prices.
- Traduzioni EN/DE/FR (codice già i18n-ready da v1).
- Eventuali nuovi indici Energy Index basati su dati di traffico reale.

### Out of scope (esplicito)
- Comparatore di singoli fornitori → vive su energiapro.biz.
- Form di richiesta preventivo / contatto fornitore → vive su energiapro.biz.
- Prezzi industriali / B2B → solo residenziale in v1.
- Dati tick-by-tick / intraday continuous → non esistono pubblicamente per questi mercati.

## 5. Esperienza utente

### Homepage
Layout 3 fasce verticali, dark mode di default + toggle chiaro:

1. **Top: ticker scorrevole** (CSS animation continua) — card con PUN, PSV, day-ahead paesi EU, frecce verde/rosso, click → pagina dettaglio.
2. **Hero: mappa interattiva** con tab `🇮🇹 Italia` (default) | `🇪🇺 Europa`. Choropleth colorato per prezzo. Tooltip al passaggio. Click → pagina zona/paese. Sotto, mini-grafico PUN/PSV ultimo mese stile TradingView.
3. **Sotto: 4 card "Energy Index"** — Fisse Luce, Variabili Luce, Fisse Gas, Variabili Gas. Ogni card mostra mediana, spread vs PUN/PSV, distribuzione min-mediana-max, sample size, CTA verso energiapro.biz.
4. **Footer**: fonti dichiarate (GME, ARERA, ENTSO-E), disclaimer informativo, link a energiapro.biz.

### Pagine secondarie (URL = SEO)
- `/it/indice/pun` · `/it/indice/psv` — dettaglio indice, storico fino a 5 anni, FAQ, link a energiapro.
- `/it/zona/[nord|centro-nord|centro-sud|sud|sicilia|sardegna]` — pagina zona MGP.
- `/it/paese/[de|fr|es|nl|...]` — paesi EU con day-ahead ENTSO-E.
- `/it/indice-energy-index/[fisse-luce|variabili-luce|fisse-gas|variabili-gas]` — metodologia + valore corrente + storico.
- `/it/glossario`, `/it/metodologia`, `/it/about`.

### Identità visiva
Tema scuro default (look "terminale Bloomberg"), font sans (Inter), tabular-nums per i numeri, accenti verde/rosso per variazioni. Toggle dark/light.

## 6. Modello dati (Supabase Postgres)

Principio: ogni "cosa che ha un prezzo nel tempo" è un `asset` generico. Aggiungere paesi/indici è una INSERT, non una migrazione.

### Tabelle core

**`geography`** — gerarchia continente → paese → zona
```
id, kind (continent|country|zone), code (EU, IT, IT-SUD, DE...),
name_it, name_en, parent_id, geojson_ref
```

**`assets`** — riga per ogni cosa quotata
```
id, slug (pun, psv, pun-zona-sud, de-day-ahead, energy-index-fisse-luce),
kind (wholesale_index | country_dayahead | retail_aggregate),
commodity (electricity | gas), unit (€/MWh, €/kWh, €/Smc),
geography_id, source (gme | entsoe | arera | computed),
methodology_url
```

> **Nota su `assets.unit` per offerte variabili ARERA**: il valore memorizzato è uno **spread (alpha) sul prezzo di riferimento PUN/PSV**, NON un prezzo assoluto. La UI deve combinare alpha + reference per produrre un €/kWh comparabile ai prezzi fissi. Opzione raccomandata: aggiungere un campo `pricing_kind ∈ {absolute, spread_on_reference}` negli `assets` per disambiguare il calcolo a valle (UI, API pubblica, materialized views).

**`price_observations`** — time series, una riga per (asset_id, observed_at)
```
id, asset_id, observed_at (timestamptz, momento del prezzo),
recorded_at (quando ingerito), value (numeric),
granularity (hourly | daily), extra (jsonb)
UNIQUE (asset_id, observed_at)
```

**`arera_offers`** — raw offerte mercato libero, storiche
```
id, offer_code, supplier, commodity, price_type (fisso | variabile),
price_value, valid_from, valid_to, raw (jsonb)
```

**`energy_index_aggregates`** — calcolato 1×/giorno
```
id, aggregate_slug (fisse-luce, variabili-luce, fisse-gas, variabili-gas),
computed_at (date), median, p25, p75, min, max,
sample_size, spread_vs_reference_pct
```

**`etl_runs`** — bookkeeping cron
```
id, source, started_at, finished_at, status,
rows_ingested, error_message
```

### Materialized view

**`mv_latest_price_per_asset`** — una riga per asset col prezzo più recente. Refreshed `CONCURRENTLY` in coda a ogni ETL. È quella che alimenta ticker e mappa con 1 sola query veloce.

### Sicurezza (RLS)
- Lettura pubblica anonima: `assets`, `geography`, `price_observations`, `energy_index_aggregates`, `mv_latest_price_per_asset`.
- Scrittura: solo `service_role` via Edge Functions ETL.
- `arera_offers` (raw) non leggibile da frontend, solo gli aggregati derivati.

## 7. Pipeline dati (Supabase Edge Functions + Cron)

Tutte idempotenti via UPSERT su chiavi naturali. Tutte scrivono in `etl_runs`.

| Function | Cron (Europe/Rome) | Sorgente | Output |
|---|---|---|---|
| `etl-gme-pun` | Daily 13:00 | **DNN scraping del sito pubblico GME** (helper condiviso `spikes/lib/gme-dnn.ts` validato in Fase 0). API ufficiale `api.mercatoelettrico.org` come Plan B SOLO con licenza commerciale GME separata (la licenza standard è "uso informativo privato" — non utilizzabile per pubblicazione pubblica). | 24h × (1 PUN nazionale + 6 zone) → `price_observations` |
| `etl-gme-psv` | Daily 17:00 | **DNN scraping del sito pubblico GME** (stesso helper condiviso). API ufficiale `api.mercatoelettrico.org` come Plan B SOLO con licenza commerciale GME separata (idem PUN). | 1 PSV daily → `price_observations` |
| `etl-entsoe-dayahead` | Daily 14:00 | ENTSO-E Restful API (`https://web-api.tp.entsoe.eu/api`, documentType A44, securityToken UUID). **Resolution PT15M** (96 punti/giorno per zona, non 24). **curveType A03** può fornire sparse points con propagazione implicita: l'ETL deve espanderli in 96 quarter-hour intervals densi prima dello storage. **Multi-TimeSeries** possibili (asta primaria + secondaria): selezione canonica via `auction.type=A01` o `classificationSequence` minore. **Attribuzione** obbligatoria: "Source: ENTSO-E Transparency Platform" + link `https://transparency.entsoe.eu/` nel footer. | day-ahead 15-20 paesi EU → `price_observations` |
| `etl-arera-offers` | Weekly Mon 06:00 UTC | **bulk CSV PLACET pubblico** sul Portale Offerte ARERA (`/portaleOfferte/resources/opendata/csv/{kind}/{YYYY}_{M}/PO_*_YYYYMMDD.csv`), regime open data legalmente dichiarato (L. 190/2012 + D.Lgs. 33/2013), niente scraping HTML necessario. | diff offerte mercato libero → `arera_offers` |
| `compute-energy-index` | Daily 04:00 | `arera_offers` attive | 4 righe → `energy_index_aggregates` |
| `refresh-views` | Dopo ogni ETL | — | refresh `mv_latest_price_per_asset` |

**Affidabilità**:
- Retry 3 tentativi con backoff esponenziale (10s, 60s, 300s).
- Alert via email se ETL fallisce 2 giorni di fila (no spam al primo errore).
- Staleness visibile in UI: badge "aggiornato Nh fa", giallo se >24h, rosso se >72h.

**Spike fonti dati**: *La Fase 0 (vedi `docs/plans/2026-05-01-spike-report.md`) ha già verificato tutte le 4 fonti — vedi quel documento per gli endpoint validati e i caveat operativi.*

## 8. Architettura tecnica

### Stack
- **Frontend**: Next.js (App Router) + TypeScript, hosting Netlify.
- **Backend / DB**: Supabase (Postgres + Edge Functions + Scheduled Functions).
- **Mappa**: react-leaflet + topojson (zone MGP, paesi EU).
- **Grafici**: TradingView Lightweight Charts (look "borsa", gratuita, leggera).
- **i18n**: next-intl, URL `/it/...`, struttura pronta per `/en/...` da v2.
- **Analytics**: Plausible o Umami (privacy-friendly, no cookie banner aggressivo).

### Struttura repo (monorepo)
```
energy-index/
├── app/[locale]/...          # Next.js App Router
├── components/                # ticker, map, chart, index-card, ui
├── lib/                       # supabase, i18n, format
├── content/it/                # FAQ, glossario, metodologia in markdown
├── supabase/
│   ├── migrations/            # SQL schema versioning
│   ├── functions/             # 6 Edge Functions ETL
│   └── seed.sql               # geography + assets seed
├── public/geojson/            # zone MGP + paesi EU
├── tests/                     # Vitest unit + Playwright smoke
└── netlify.toml
```

### Performance / costi
- Pagine indice/zona/paese: **statiche con ISR** (revalidate 6h o webhook post-ETL), riservite da CDN Netlify.
- Homepage: SSR con cache 60s.
- Mappa: client component idratato dopo first paint.
- Tier gratuiti Netlify + Supabase reggono decine di migliaia di visite/mese. **Costo previsto primi 6 mesi: 0€**.

### Testing pragmatico
- **Unit (Vitest)**: parser XML GME, parser ARERA, calcolo aggregati Energy Index. Pezzi rischiosi.
- **E2E (Playwright)**: 3 smoke test (homepage, mappa, pagina indice).
- Niente test UI esaustivi in v1.

### Ambienti
- Production: progetto Supabase principale + Netlify production.
- Preview: Supabase Branches per ogni PR + Netlify deploy preview automatico.
- Migrations: `supabase db push` in CI prima del deploy frontend.

## 9. SEO & ponte verso energiapro.biz

### Strategia SEO a 3 livelli
1. **High-intent informativo**: "PUN oggi", "PSV oggi", "prezzo gas oggi". → Homepage + `/indice/pun`, `/indice/psv`.
2. **Long-tail tematico**: "PUN zona sud", "prezzo elettricità Sicilia", "day-ahead Germania". → Pagine `/zona/...` e `/paese/...`.
3. **Brand proprietario** (creiamo la query): "Energy Index Fisse Luce", "spread offerte vs PUN". → Pagine `/indice-energy-index/...` con metodologia trasparente.

### Hygiene SEO
- Structured data JSON-LD: `Dataset` per indici, `BreadcrumbList`, `FAQPage`.
- Sitemap dinamica generata dal DB.
- Hreflang già pronto per v2 multilingua.
- OG image dinamica per pagina indice (screenshot grafico server-side).

### Bridge to energiapro.biz
- CTA card Energy Index: "Vedi quanto risparmieresti →" con UTM `?utm_source=energy-index&utm_medium=homepage_card&utm_campaign=fisse_luce`.
- CTA fondo pagina `/indice/pun`: "Trova la tariffa migliore basata sul PUN attuale".
- Banner sticky discreto chiudibile in basso.
- **Mai** form lead su Energy Index. Conversione tutta su energiapro.biz.

## 10. Roadmap

| Fase | Tempi | Output |
|---|---|---|
| **Fase 0 — Spike** ✅ completata | 2026-05-01 → 2026-05-04 | 4 script standalone (GME PUN, GME PSV, ENTSO-E, ARERA) che hanno scaricato dati reali con successo. Decisioni go/plan-B documentate in `docs/plans/2026-05-01-spike-report.md`. |
| **Fase 1 — MVP Italia** | Settimane 2-5 | Sito online: homepage + ticker + mappa Italia + 4 card Energy Index + pagine `/indice/pun`, `/indice/psv`, `/zona/[6]`, glossario, metodologia, about. ETL GME + ARERA + Energy Index attivi. |
| **Fase 2 — Europa** | Settimane 6-8 | Mappa Europa + pagine `/paese/[de\|fr\|es\|...]`. ETL ENTSO-E. SEO ottimizzato (sitemap, structured data, OG dinamiche). |
| **Fase 3 — Espansione** | Mese 3+ | Traduzioni EN (poi DE/FR). Mondo "leggero" via Eurostat/IEA. Decisioni guidate da dati di traffico reali. |

## 11. Open items (non bloccanti per partire)

1. **Dominio**: candidati `energyindex.it` / `.eu` / `.com`. Da verificare disponibilità.
2. **Logo / brand identity**: wordmark testuale al lancio, logo dopo.
3. **Privacy / cookie**: Plausible/Umami evita cookie banner, ma serve privacy policy + termini d'uso.
4. **Note legali sui dati**:
   - **GME**: disclaimer *"Fonte: GME — Gestore dei Mercati Energetici"*. Verifica formale con GME se la ripubblicazione su sito informativo gratuito è consentita anche per il canale DNN — la licenza standard dell'API ufficiale (*"uso informativo privato"*) NON è compatibile con il nostro caso d'uso, da affrontare prima del launch pubblico.
   - **ARERA**: disclaimer *"Fonte: Portale Offerte — Acquirente Unico S.p.A. — ARERA"* obbligatorio sulla card Energy Index e nel footer. Regime open data legalmente dichiarato (L. 190/2012 + D.Lgs. 33/2013) — riutilizzo libero anche per servizi commerciali derivati.
   - **ENTSO-E**: disclaimer *"Source: ENTSO-E Transparency Platform"* con link a https://transparency.entsoe.eu/, obbligatorio nel footer e in eventuali export. Open under EU Regulation 543/2013.

## 12. Decisioni-chiave (riepilogo)

| Area | Decisione |
|---|---|
| Aggiornamento dati | Giornaliero reale, effetto visivo "borsa" |
| Posizionamento | Vetrina pubblica → ponte SEO verso energiapro.biz |
| Offerte fornitori | Solo aggregati Energy Index da ARERA, no singolo fornitore |
| Scope v1 | Europa: Italia ricca (zone MGP) + paesi EU "leggeri" (ENTSO-E) |
| Stack | Next.js + Supabase + Netlify, react-leaflet + TradingView Lightweight Charts |
| Lingue | Italiano in v1, codice i18n-ready per v2 EN/DE/FR |
| Tema | Dark default + toggle chiaro |
| Brand indice proprietario | "Energy Index · Fisse/Variabili Luce/Gas" |
| Fonti | GME (PUN/PSV), ENTSO-E (paesi EU), ARERA Portale Offerte |
| Costi attesi 6 mesi | 0€ (tier gratuiti) |
