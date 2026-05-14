-- Slice 8 — Forecast pubblico: tabelle base.
--
-- forecasts: storico di tutte le predizioni emesse (per ricostruire track record).
-- forecast_metrics: aggregati MAPE/RMSE/hit_ratio/coverage per finestre temporali.

CREATE TABLE IF NOT EXISTS forecasts (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,             -- giorno per cui prevediamo
  generated_at TIMESTAMPTZ NOT NULL,       -- quando il forecast e' stato emesso
  horizon_days INT NOT NULL,               -- 7, 30, 90, 180
  value NUMERIC(12, 4) NOT NULL,           -- previsione puntuale
  value_lower NUMERIC(12, 4),              -- banda 5° percentile
  value_upper NUMERIC(12, 4),              -- banda 95° percentile
  drivers JSONB,                           -- top 3-4 driver attribution
  model_version VARCHAR(20) NOT NULL,      -- es. "ridge-v1.0"
  UNIQUE (asset_id, forecast_date, generated_at, horizon_days),
  CHECK (horizon_days IN (7, 30, 90, 180)),
  CHECK (forecast_date >= generated_at::date)
);

CREATE INDEX IF NOT EXISTS idx_forecasts_asset_horizon_date
  ON forecasts(asset_id, horizon_days, forecast_date DESC);

CREATE INDEX IF NOT EXISTS idx_forecasts_generated_at
  ON forecasts(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_forecasts_latest_per_asset_horizon
  ON forecasts(asset_id, horizon_days, generated_at DESC);

CREATE TABLE IF NOT EXISTS forecast_metrics (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  horizon_days INT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  mape NUMERIC(6, 3),                      -- Mean Absolute Percentage Error (%)
  rmse NUMERIC(12, 4),                     -- Root Mean Squared Error
  hit_ratio NUMERIC(5, 3),                 -- % indovinata direzione (0-1)
  coverage NUMERIC(5, 3),                  -- % real dentro banda 5-95% (0-1)
  n_observations INT NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (asset_id, horizon_days, period_start, period_end),
  CHECK (horizon_days IN (7, 30, 90, 180)),
  CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_metrics_asset_horizon
  ON forecast_metrics(asset_id, horizon_days, period_end DESC);

-- Niente RLS public: l'accesso passa solo via RPC (vedi prossima migration).
-- service_role mantiene full access tramite bypass standard.
