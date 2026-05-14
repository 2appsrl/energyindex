-- Slice 8 — Input validation per RPC forecast (post-review).
--
-- Aggiunge un guard RAISE EXCEPTION su p_horizon_days per:
-- - get_forecast_chart_data
-- - get_forecast_latest
--
-- Senza il guard, p_horizon_days = 42 (qualunque valore non in {7,30,90,180})
-- ritorna silentemente 0 row. La UI lo mostra come "Forecast in elaborazione"
-- invece di esporre l'errore del chiamante.
--
-- Switch LANGUAGE sql -> plpgsql per usare IF/RAISE. Pattern consolidato:
-- vedi get_price_series in 20260511000001.

CREATE OR REPLACE FUNCTION get_forecast_chart_data(
  p_asset_id BIGINT,
  p_horizon_days INT
)
RETURNS TABLE (
  date DATE,
  source TEXT,
  value NUMERIC,
  value_lower NUMERIC,
  value_upper NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_horizon_days NOT IN (7, 30, 90, 180) THEN
    RAISE EXCEPTION 'invalid horizon_days: % (must be 7, 30, 90, 180)', p_horizon_days;
  END IF;

  RETURN QUERY
  -- Storico ultimi 365 giorni
  SELECT DATE(po.observed_at) AS date,
         'history'::text AS source,
         AVG(po.value)::numeric AS value,
         NULL::NUMERIC AS value_lower,
         NULL::NUMERIC AS value_upper
  FROM price_observations po
  WHERE po.asset_id = p_asset_id
    AND po.observed_at >= NOW() - INTERVAL '1 year'
    AND po.observed_at <= NOW()
  GROUP BY 1
  UNION ALL
  -- Forecast piu' recente: tutti i row del batch con generated_at = MAX
  -- (preserva la traiettoria completa, non solo un punto).
  SELECT f.forecast_date AS date,
         'forecast'::text AS source,
         f.value,
         f.value_lower,
         f.value_upper
  FROM forecasts f
  WHERE f.asset_id = p_asset_id
    AND f.horizon_days = p_horizon_days
    AND f.generated_at = (
      SELECT MAX(generated_at) FROM forecasts
      WHERE asset_id = p_asset_id AND horizon_days = p_horizon_days
    )
  ORDER BY 1;
END $$;

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
  spot_value NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_horizon_days NOT IN (7, 30, 90, 180) THEN
    RAISE EXCEPTION 'invalid horizon_days: % (must be 7, 30, 90, 180)', p_horizon_days;
  END IF;

  RETURN QUERY
  WITH latest_forecast AS (
    SELECT DISTINCT ON (f.asset_id)
      f.asset_id, f.forecast_date, f.generated_at,
      f.value, f.value_lower, f.value_upper, f.drivers
    FROM forecasts f
    WHERE f.horizon_days = p_horizon_days
    ORDER BY f.asset_id, f.generated_at DESC
  ),
  latest_spot AS (
    SELECT DISTINCT ON (po.asset_id)
      po.asset_id, po.value AS spot_value
    FROM price_observations po
    WHERE po.observed_at <= NOW()
    ORDER BY po.asset_id, po.observed_at DESC
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
END $$;
