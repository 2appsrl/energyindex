-- Slice 8 — RPC per il forecast pubblico.
--
-- 1) get_forecast_chart_data: serie unificata storico+forecast per il chart UI.
-- 2) get_forecast_metrics_latest: ultime metriche per ogni asset/horizon.
-- 3) get_forecast_latest: forecast sintetico per le card di /it/forecast.
--
-- Tutte SECURITY DEFINER: i client anon non hanno SELECT sulle tabelle
-- forecasts/forecast_metrics (RLS enabled, no policy), accedono solo via
-- queste funzioni.

-- RPC 1: chart data unificato.
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
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Storico ultimi 365 giorni
  SELECT DATE(observed_at) AS date,
         'history'::text AS source,
         AVG(value)::numeric AS value,
         NULL::NUMERIC AS value_lower,
         NULL::NUMERIC AS value_upper
  FROM price_observations
  WHERE asset_id = p_asset_id
    AND observed_at >= NOW() - INTERVAL '1 year'
    AND observed_at <= NOW()
  GROUP BY 1
  UNION ALL
  -- Forecast piu' recente: filtra per generated_at MAX
  SELECT forecast_date AS date,
         'forecast'::text AS source,
         value,
         value_lower,
         value_upper
  FROM forecasts
  WHERE asset_id = p_asset_id
    AND horizon_days = p_horizon_days
    AND generated_at = (
      SELECT MAX(generated_at) FROM forecasts
      WHERE asset_id = p_asset_id AND horizon_days = p_horizon_days
    )
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION get_forecast_chart_data(BIGINT, INT) TO anon, authenticated;

-- RPC 2: metriche track record (ultima finestra per ogni asset+horizon).
CREATE OR REPLACE FUNCTION get_forecast_metrics_latest()
RETURNS TABLE (
  asset_id BIGINT,
  asset_slug TEXT,
  display_name_it TEXT,
  horizon_days INT,
  period_start DATE,
  period_end DATE,
  mape NUMERIC,
  rmse NUMERIC,
  hit_ratio NUMERIC,
  coverage NUMERIC,
  n_observations INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (fm.asset_id, fm.horizon_days)
    fm.asset_id,
    a.slug AS asset_slug,
    a.display_name_it,
    fm.horizon_days,
    fm.period_start,
    fm.period_end,
    fm.mape,
    fm.rmse,
    fm.hit_ratio,
    fm.coverage,
    fm.n_observations
  FROM forecast_metrics fm
  JOIN assets a ON a.id = fm.asset_id
  ORDER BY fm.asset_id, fm.horizon_days, fm.period_end DESC;
$$;

GRANT EXECUTE ON FUNCTION get_forecast_metrics_latest() TO anon, authenticated;

-- RPC 3: forecast latest sintetico per le card di /it/forecast.
-- Ritorna un row per ogni (asset, horizon) con il forecast piu' recente.
CREATE OR REPLACE FUNCTION get_forecast_latest(
  p_asset_slugs TEXT[],
  p_horizon_days INT
)
RETURNS TABLE (
  asset_slug TEXT,
  display_name_it TEXT,
  unit TEXT,
  forecast_date DATE,
  generated_at TIMESTAMPTZ,
  value NUMERIC,
  value_lower NUMERIC,
  value_upper NUMERIC,
  drivers JSONB,
  spot_value NUMERIC                       -- ultimo prezzo osservato
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest_forecast AS (
    SELECT DISTINCT ON (asset_id)
      asset_id, forecast_date, generated_at,
      value, value_lower, value_upper, drivers
    FROM forecasts
    WHERE horizon_days = p_horizon_days
    ORDER BY asset_id, generated_at DESC
  ),
  latest_spot AS (
    SELECT DISTINCT ON (asset_id)
      asset_id, value AS spot_value
    FROM price_observations
    WHERE observed_at <= NOW()
    ORDER BY asset_id, observed_at DESC
  )
  SELECT a.slug AS asset_slug,
         a.display_name_it,
         a.unit,
         lf.forecast_date,
         lf.generated_at,
         lf.value,
         lf.value_lower,
         lf.value_upper,
         lf.drivers,
         ls.spot_value
  FROM assets a
  JOIN latest_forecast lf ON lf.asset_id = a.id
  LEFT JOIN latest_spot ls ON ls.asset_id = a.id
  WHERE a.slug = ANY(p_asset_slugs)
  ORDER BY array_position(p_asset_slugs, a.slug);
$$;

GRANT EXECUTE ON FUNCTION get_forecast_latest(TEXT[], INT) TO anon, authenticated;
