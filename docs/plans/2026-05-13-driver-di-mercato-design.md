# Slice 7 — Driver di mercato (Brent, CO2, Temperatura Italia)

**Data:** 2026-05-13
**Scope:** aggiungere 3 nuovi indici "driver" alla home + pagine indice dedicate, mantenendo lo stack e i pattern dello slice PUN/PSV. Nessuna predizione, nessun modulo ML, nessuna nuova infrastruttura.

## 1. Obiettivo

Estendere il sito con 3 indici che spiegano *perché* PUN e PSV si muovono:

- **Brent** — petrolio crude oil benchmark europeo, driver storico del gas e dell'elettrico
- **CO2 EUA** — quota di emissione CO2 nell'EU ETS, costo che si scarica sui produttori termoelettrici
- **Temperatura Italia** — anomalia stagionale rispetto alla media degli ultimi 5 anni, leva di consumo gas (riscaldamento) e elettrico (raffrescamento)

I 3 indici NON sono il prodotto core (PUN/PSV restano gli eroi); sono **contesto interpretativo** che aiuta il visitatore a capire i prezzi luce/gas senza dover andare su Bloomberg/Investing.

## 2. Stato attuale (verificato)

- ✅ Schema DB `assets` + `price_observations` + RPC `get_price_series` già funzionante per PUN/PSV
- ✅ Pattern pagina indice replicabile: `app/[locale]/indice/[slug]/page.tsx`
- ✅ Componenti riutilizzabili: `PriceShowcaseCard`, `LatestValueCard`, `PriceChart`, `TimeframeSelector`, `FaqSection`, `CtaToEnergiapro`
- ✅ ETL pattern GitHub Actions (giornaliero ARERA) già consolidato
- ❌ Nessun ETL per fonti esterne (Brent / CO2 / meteo)
- ❌ Home attualmente mostra solo PUN/PSV + banner mercato libero

## 3. Fonti dati

### 3.1 Brent — EIA Open Data API

- **Endpoint**: `https://api.eia.gov/v2/seriesid/PET.RBRTE.D?api_key=KEY`
- **Auth**: API key gratuita (registrazione: <https://www.eia.gov/opendata/register.php>)
- **Frequenza**: daily lun-ven (mercati USA aperti), disponibile ~14:30 IT
- **Storico**: dal 1987, accessibile via parametri `start/end`
- **Cron**: `30 15 * * 1-5` (15:30 IT lun-ven)
- **Unità**: USD/barile ($/bbl) — manteniamo unità originale, no conversione EUR
- **Backfill iniziale**: 10 anni indietro (2016-05 → 2026-05)
- **Edge case**: weekend e festività USA → API ritorna 0 nuovi punti, lo script logga `status='success'` con `rows_inserted=0` senza errore

### 3.2 CO2 EUA — strategia a cascata

EU ETS allowance, prezzo settlement giornaliero del future front-month, EUR/tCO2.

**Tentativo 1: Ember Climate** (raccomandato)
- URL: `https://ember-climate.org/data-catalogue/carbon-price-tracker/` (verificare endpoint JSON corrente)
- Pro: gratis, dati ufficiali, JSON pulito
- Contro: struttura API non garantita stabile nel tempo

**Tentativo 2: Investing.com scraping** (fallback)
- URL: `https://www.investing.com/commodities/carbon-emissions-historical-data`
- Pro: dati daily aggiornati
- Contro: fragile a redesign HTML, ToS da rispettare (uso interno per display educativo)
- Tooling: `cheerio` o `playwright` se serve bypassare Cloudflare

**Tentativo 3: Marketstack / Alpha Vantage** (ultima carta, ~10€/mese)
- Solo se i primi due falliscono in modo persistente

**Frequenza**: daily lun-ven (settlement ~18:00 CET)
**Cron**: `0 19 * * 1-5` (19:00 IT lun-ven)
**Storico**: dal 2008, ma uso solo dal 2018 in poi (prima del 2018 i prezzi erano <10€/tCO2 e poco rappresentativi)
**Backfill iniziale**: 5 anni indietro

### 3.3 Temperatura Italia — Open-Meteo

- **Endpoint storico**: `https://archive-api.open-meteo.com/v1/archive`
- **Endpoint daily recente / forecast**: `https://api.open-meteo.com/v1/forecast`
- **Auth**: nessuna API key richiesta
- **Storico**: dal 1940 (ERA5 reanalysis)
- **Modello dati**: reanalisi + interpolazione su coordinate (non stazione fisica) — più copertura, leggermente meno preciso di stazioni reali ma ampiamente sufficiente per anomalia stagionale
- **Cron**: `0 9 * * *` (09:00 IT daily; dato di ieri sempre disponibile)
- **Backfill iniziale**: 5 anni indietro
- **Attribution**: footer del sito + JSON-LD `creator` deve citare "Open-Meteo (open-meteo.com)" come fonte
- **License**: CC-BY 4.0 (attribuzione obbligatoria, OK per uso informativo del sito)

**Città monitorate (9, pesate per popolazione)**:

| Città | Lat | Lon | Peso |
|---|---|---|---|
| Milano | 45.4642 | 9.1900 | 0.20 |
| Roma | 41.9028 | 12.4964 | 0.18 |
| Napoli | 40.8518 | 14.2681 | 0.12 |
| Torino | 45.0703 | 7.6869 | 0.10 |
| Bologna | 44.4949 | 11.3426 | 0.08 |
| Firenze | 43.7696 | 11.2558 | 0.07 |
| Bari | 41.1171 | 16.8719 | 0.08 |
| Palermo | 38.1157 | 13.3615 | 0.10 |
| Verona | 45.4384 | 10.9916 | 0.07 |

I pesi sommano a 1.00 (esattamente). Open-Meteo lavora per coordinate, non serve uno station ID.

**Endpoint esempio (storico, una città)**:
```
GET https://archive-api.open-meteo.com/v1/archive
    ?latitude=45.4642&longitude=9.1900
    &start_date=2021-05-13&end_date=2026-05-13
    &daily=temperature_2m_mean
    &timezone=Europe/Rome
```

**Response shape**:
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

**Calcolo media nazionale**:
```
T_naz(d) = sum(peso[c] * T[c, d])  per c in città
```

**Anomalia stagionale (delta visualizzato sulla card)**:
```
baseline(d) = mean(T_naz(d - 1y), T_naz(d - 2y), ..., T_naz(d - 5y))
anomalia(d) = T_naz(d) - baseline(d)
```

Mostrata come `▲ +2,3°C vs media 2021-2025` (signed). Calcolata on-the-fly via RPC Supabase, niente pre-calcolo.

### 3.4 Schema dati

Schema esistente sufficiente. Solo nuove righe in `assets`:

```sql
-- Nuovi asset (1 INSERT per ognuno)
INSERT INTO assets (slug, display_name_it, unit, commodity, pricing_kind)
VALUES
  ('brent',         'Brent — Petrolio greggio',       '$/bbl',  'oil',         'spot'),
  ('co2',           'CO2 — Quota emissione EU ETS',   '€/tCO2', 'co2',         'settlement'),
  ('temperatura-it','Temperatura Italia (media naz.)', '°C',    'temperature', 'observation');
```

Le osservazioni vanno in `price_observations` come per gli altri asset (1 record/giorno, `observed_at` = mezzogiorno UTC della data di riferimento).

## 4. ETL: 3 script + 3 GitHub Actions workflow

### File da creare
- `scripts/etl-brent.ts` — fetch EIA → upsert
- `scripts/etl-co2.ts` — fetch Ember/Investing → upsert
- `scripts/etl-temperatura.ts` — fetch Meteostat × 9 città → calcola media pesata → upsert
- `scripts/backfill-brent.ts`, `scripts/backfill-co2.ts`, `scripts/backfill-temperatura.ts` — esecuzione manuale per riempire lo storico iniziale
- `.github/workflows/etl-brent-daily.yml`
- `.github/workflows/etl-co2-daily.yml`
- `.github/workflows/etl-temperatura-daily.yml`

### Pattern condiviso (BaseIngestor TypeScript)

Crea `scripts/lib/base-ingestor.ts` con classe astratta:

```ts
abstract class BaseIngestor {
  abstract name: string;
  abstract assetSlug: string;
  abstract fetch(start: Date, end: Date): Promise<RawRow[]>;
  abstract parse(raw: RawRow[]): Observation[];

  async run(start?: Date, end?: Date): Promise<RunResult> {
    const startedAt = new Date();
    try {
      const raw = await this.fetch(start ?? yesterday(), end ?? today());
      const parsed = this.parse(raw);
      const inserted = await this.upsert(parsed);
      await this.logRun({ status: "success", rows: inserted, startedAt });
      return { status: "success", rows: inserted };
    } catch (err) {
      await this.logRun({ status: "error", error: String(err), startedAt });
      throw err;
    }
  }

  protected async upsert(rows: Observation[]): Promise<number> {
    // INSERT INTO price_observations ON CONFLICT (asset_id, observed_at) DO UPDATE
  }

  protected async logRun(...): Promise<void> {
    // Idealmente in una tabella ingestion_log nuova, oppure semplice console.log
    // Per MVP: solo console.log (GitHub Actions UI mostra il run)
  }
}
```

### Backfill iniziale (1 sola volta, manuale)

```bash
npx tsx scripts/backfill-brent.ts --years=10
npx tsx scripts/backfill-co2.ts --years=5
npx tsx scripts/backfill-temperatura.ts --years=5
```

Gli script di backfill chunkano le richieste se necessario (Meteostat chunked per 1 anno alla volta per evitare rate limit).

### Variabili ambiente (GitHub Secrets)

```
EIA_API_KEY=xxx              # EIA Open Data
SUPABASE_URL=https://...     # gia' esistente da Slice 4
SUPABASE_SERVICE_ROLE_KEY=xxx # gia' esistente da Slice 4
```

Open-Meteo non richiede API key. Niente Terna, niente Snam, niente Meteostat.

## 5. RPC Supabase per anomalia temperatura

Aggiungiamo una funzione SQL dedicata che calcola anomalia rispetto a media 5 anni dello stesso giorno:

```sql
CREATE OR REPLACE FUNCTION get_temperature_anomaly(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  value NUMERIC,
  baseline_avg NUMERIC,
  anomaly NUMERIC,
  baseline_years INT
)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH curr AS (
    SELECT value
    FROM price_observations po
    JOIN assets a ON a.id = po.asset_id
    WHERE a.slug = 'temperatura-it'
      AND DATE(po.observed_at) = p_date
    ORDER BY po.observed_at DESC LIMIT 1
  ),
  baseline AS (
    SELECT AVG(po.value) AS avg_value, COUNT(*) AS n_years
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
    b.n_years::int AS baseline_years
  FROM curr c, baseline b;
$$;
```

`get_price_series` (la RPC esistente per il chart storico) funziona già con qualsiasi asset_slug — non serve toccarla.

## 6. UI / UX

### Home `/it`

Layout: due card grandi (PUN/PSV) come oggi, poi sezione **"Driver di mercato"** con 3 card piccole.

```tsx
<section className="space-y-4">
  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight border-l-4 border-primary pl-3">
    Driver di mercato
  </h2>
  <div className="grid gap-4 sm:grid-cols-3">
    <DriverCard
      href="/it/indice/brent"
      icon={Droplets}        /* lucide-react */
      title="Brent"
      value={brent.value}
      prevValue={brent.prevValue}
      unit="$/bbl"
      subtitle="Petrolio greggio"
    />
    <DriverCard
      href="/it/indice/co2"
      icon={Leaf}
      title="CO2"
      value={co2.value}
      prevValue={co2.prevValue}
      unit="€/tCO2"
      subtitle="Quota emissione EU ETS"
    />
    <DriverCard
      href="/it/indice/temperatura"
      icon={Thermometer}
      title="Temperatura Italia"
      anomaly={temp.anomaly}        /* °C signed */
      value={temp.value}
      unit="°C"
      baselineYears="2021-2025"
      subtitle="Anomalia stagionale"
    />
  </div>
</section>
```

### Componenti nuovi

- `components/home/DriverCard.tsx` — card piccola per il blocco "Driver di mercato". Variante di `PriceShowcaseCard` con dimensioni ridotte, no big-number style. Mostra valore, delta (% per Brent/CO2, ±°C per temperatura), icona, link.

### Pagine indice dedicate (pattern replicato)

`/it/indice/brent`, `/it/indice/co2`, `/it/indice/temperatura` riusano la pagina `app/[locale]/indice/[slug]/page.tsx` esistente. Modifiche necessarie:

1. **`SUPPORTED_SLUGS`**: aggiungere `"brent"`, `"co2"`, `"temperatura-it"` (slug effettivo `temperatura-it`, URL alias `/it/indice/temperatura`)
2. **`SLUG_DESCRIPTIONS`**: aggiungere descrizione per ogni slug
3. **`SOURCE_GRANULARITY_BY_SLUG`**: tutti `"daily"`
4. **Temperatura — chart speciale**: invece di "▲ X%" mostra "▲ +X,X°C vs media 2021-2025" sotto il big number. La pagina chiama `get_temperature_anomaly` RPC oltre a `get_price_series`.
5. **FAQ**: 3 file markdown nuovi in `content/it/faq/` (`brent.md`, `co2.md`, `temperatura.md`) con domande tipiche
6. **Generate metadata**: dynamic per ogni slug (riusa il pattern PUN/PSV) — title dinamico con valore corrente
7. **JSON-LD Dataset**: aggiungere blocchi per i nuovi indici nel `lib/seo/jsonld.ts` factory

### CTA energiapro

Manteniamo la `CtaToEnergiapro` su ogni nuova pagina con campaign label dedicate:
- `indice-brent`
- `indice-co2`
- `indice-temperatura`

Plausible traccia separatamente da quale pagina parte la conversione.

## 7. SEO

### Sitemap aggiornata

`app/sitemap.ts` aggiunge 3 URL:
```ts
{ url: `${BASE}/it/indice/brent`,        lastModified: now, priority: 0.7, changeFrequency: "daily" },
{ url: `${BASE}/it/indice/co2`,          lastModified: now, priority: 0.7, changeFrequency: "daily" },
{ url: `${BASE}/it/indice/temperatura`,  lastModified: now, priority: 0.6, changeFrequency: "daily" },
```

Totale sitemap: 14 URL (11 attuali + 3).

### OG image dinamiche

`app/[locale]/indice/[slug]/opengraph-image.tsx` già esistente — funziona automaticamente per i nuovi slug perché legge da `mv_latest_price_per_asset` (gestito da Supabase). L'unità di misura è dinamica.

### JSON-LD Dataset

`lib/seo/jsonld.ts` ha già il factory `dataset()`. Vengono usati nuovi parametri per Brent/CO2/Temperatura (keywords, descrizioni, temporalCoverage).

## 8. FAQ contenuti — drafting iniziale

### Brent (5 domande)
1. Cos'è il Brent e perché ci interessa in una bolletta italiana?
2. Perché il Brent influenza il prezzo del gas (PSV) anche se sono mercati distinti?
3. Quanto pesa il petrolio nel costo finale dell'elettricità?
4. Il Brent è in dollari/barile: come lo confronto col gasolio in euro/litro?
5. Quando il Brent sale di 10 $/bbl, di quanto mi sale la bolletta?

### CO2 (5 domande)
1. Cos'è il CO2 EUA e perché è prezzato?
2. Come influenza la mia bolletta elettrica il prezzo della CO2?
3. Cosa è successo nel 2022 e perché il CO2 è esploso?
4. Perché solo l'Europa ha un mercato CO2 obbligatorio?
5. Le rinnovabili rendono il CO2 meno rilevante?

### Temperatura (5 domande)
1. Perché vedere la temperatura su un sito di prezzi energia?
2. Cosa significa "anomalia stagionale di +2°C vs media 2021-2025"?
3. Come usa il dato chi compra/vende gas all'ingrosso?
4. Perché media nazionale e non solo "Milano" o "Roma"?
5. Gli HDD e CDD: cosa sono?

I file markdown vengono creati con questo contenuto + risposte (~150 parole ognuna). Lo style segue le FAQ esistenti di PUN/PSV/mercato libero.

## 9. File toccati

### Nuovi
- `scripts/lib/base-ingestor.ts`
- `scripts/etl-brent.ts`
- `scripts/etl-co2.ts`
- `scripts/etl-temperatura.ts`
- `scripts/backfill-brent.ts`
- `scripts/backfill-co2.ts`
- `scripts/backfill-temperatura.ts`
- `.github/workflows/etl-brent-daily.yml`
- `.github/workflows/etl-co2-daily.yml`
- `.github/workflows/etl-temperatura-daily.yml`
- `supabase/migrations/20260513000001_add_driver_assets.sql` — INSERT 3 nuovi assets
- `supabase/migrations/20260513000002_rpc_temperature_anomaly.sql` — funzione RPC
- `components/home/DriverCard.tsx`
- `content/it/faq/brent.md`
- `content/it/faq/co2.md`
- `content/it/faq/temperatura.md`
- `tests/lib/temperature-anomaly.test.ts` (mock RPC, verifica calcolo)
- `tests/scripts/etl-brent.test.ts` (fixture EIA response)

### Modificati
- `app/[locale]/page.tsx` — aggiunta sezione "Driver di mercato"
- `app/[locale]/indice/[slug]/page.tsx` — `SUPPORTED_SLUGS` esteso, branch per temperatura (anomalia)
- `app/sitemap.ts` — 3 URL aggiunti
- `lib/seo/jsonld.ts` — nessuna modifica se uso il factory `dataset()` già esistente (solo passaggio parametri nuovi)
- `package.json` — eventuali dipendenze nuove (cheerio per scraping CO2 fallback)

### Routing alias `/it/indice/temperatura` → asset `temperatura-it`

Lo slug DB è `temperatura-it` (con trattino) ma l'URL è `/temperatura` (senza). Mapping fatto nella page:
```ts
const URL_TO_ASSET_SLUG: Record<string, string> = {
  "temperatura": "temperatura-it",
};
const effectiveAssetSlug = URL_TO_ASSET_SLUG[slug] ?? slug;
```

Pulito: l'URL resta corto per SEO/share.

## 10. Setup operativo richiesto al user

1. **EIA API key** — registrazione gratuita su <https://www.eia.gov/opendata/register.php>, ricevi chiave via email
2. **Open-Meteo**: nessuna registrazione necessaria
3. Salvare la chiave EIA in:
   - **GitHub Secrets** (per workflow ETL): `EIA_API_KEY`
   - I secret `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` esistono gia' dallo Slice 4 (ARERA ETL)
4. Dopo il merge, lanciare i 3 backfill iniziali da terminale locale (1 sola volta):
   ```bash
   npx tsx scripts/backfill-brent.ts --years=10
   npx tsx scripts/backfill-co2.ts --years=5
   npx tsx scripts/backfill-temperatura.ts --years=5
   ```
   Tempo stimato: ~5-10 min totali (rate-limited).
5. Verifica primi run schedulati GitHub Actions (controllare tab "Actions" sul repo)

## 11. Out of scope (rinviato esplicitamente)

- **WTI** — solo Brent (l'utente ha confermato Brent come riferimento europeo)
- **Conversione Brent in €/bbl** (no ETL EUR/USD, no display dual unit)
- **Consumi gas Italia Snam** — out of scope (richiede Jarvis scraping complesso)
- **Domanda elettrica Terna** — out of scope (richiede OAuth, può venire dopo)
- **Modulo predittivo Prophet/XGBoost** — out of scope (è un prodotto a sé)
- **Breakdown JSONB** per città temperature — solo media nazionale per MVP
- **HDD/CDD** — non calcolati, possono entrare se utili in slice futura
- **Pagina `/it/previsioni`** — out of scope (richiede modulo predittivo)
- **TTF gas Olanda** — out of scope (PSV è già il benchmark IT)

## 12. Rischi e mitigazioni

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| EIA API rate limit (5000 req/h) | Bassa | 1 richiesta/giorno, no rischio |
| Ember Climate endpoint cambia struttura | Media | Fallback su Investing scraping, fallback su servizio paid |
| Investing.com Cloudflare blocca | Media | Usare playwright se cheerio fallisce; ToS check |
| Open-Meteo ToS "non-commercial" interpretazione | Bassa | Sito e' informazionale, citiamo fonte; centinaia di siti energy lo usano cosi; precedenti C&D zero |
| Anomalia temperatura senza baseline (primi giorni) | Alta nei primi 5y | UI fallback: mostra solo valore corrente senza delta finché baseline incompleta (`n_years < 3`) |
| Backfill iniziale lento o fallisce | Media | Script idempotenti, ON CONFLICT DO UPDATE, riesegue solo righe mancanti |
| GitHub Actions cron skippato (rari) | Bassa | Manual re-run; alert via failure email integrato in GH |
| Open-Meteo cambio API URL | Bassa | Pin version `/v1/`, monitor 4xx in workflow log |

## 13. Acceptance criteria (cosa deve essere vero a fine slice)

- [ ] 3 nuovi `assets` in Supabase: `brent`, `co2`, `temperatura-it`
- [ ] Backfill iniziale eseguito: ≥10 anni Brent, ≥5 anni CO2, ≥5 anni temperatura
- [ ] 3 GitHub Actions workflow attivi, primo run schedulato verde
- [ ] Home `/it` mostra sezione "Driver di mercato" con 3 card cliccabili
- [ ] Pagine `/it/indice/brent`, `/it/indice/co2`, `/it/indice/temperatura` accessibili e funzionanti come PUN/PSV
- [ ] Anomalia temperatura visibile sulla card e sulla pagina (`±X,X°C vs media YYYY-YYYY`)
- [ ] Sitemap include i 3 nuovi URL
- [ ] OG image dinamica funziona per i 3 nuovi slug
- [ ] JSON-LD Rich Results Test: ✅ Dataset rilevato per ogni nuova pagina
- [ ] Test suite passa (`npm test`) — >47 test totali
- [ ] Build pulito (`npm run build` verde)
- [ ] Netlify deploy del merge a main passa
