-- Energy Index — Slice 1 — Schema iniziale
-- Documenta: docs/plans/2026-05-01-energy-index-design.md sez. 6

-- ===== Estensioni =====
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- pg_cron timezone -> Europe/Rome (per leggibilità schedule)
-- NOTA: ALTER DATABASE non eseguibile da migration (richiede server restart o privilegi superuser).
-- Da applicare manualmente via Supabase Dashboard → SQL Editor:
--   ALTER DATABASE postgres SET cron.timezone = 'Europe/Rome';
-- Errore osservato: "parameter cron.timezone cannot be changed without restarting the server (SQLSTATE 55P02)"

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

-- Indice parziale: now() non e' IMMUTABLE quindi non e' ammesso nel predicato.
-- Compromesso: indicizziamo per commodity+price_type+valid_to, lasciando al planner
-- l'uso del valid_to per filtri temporali. Il filtro "attive" (valid_to IS NULL OR > now())
-- e' applicato a query-time.
CREATE INDEX idx_arera_offers_active ON arera_offers(commodity, price_type, valid_to);

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
