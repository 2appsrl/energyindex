-- Rinomina get_pun_series -> get_price_series (asset-agnostic) e aggiunge
-- supporto bucket='week' (necessario per PSV daily su timeframe 1Y).

DROP FUNCTION IF EXISTS get_pun_series(BIGINT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_price_series(
  p_asset_id BIGINT,
  p_interval TEXT,
  p_bucket TEXT
)
RETURNS TABLE(observed_at TIMESTAMPTZ, value NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_bucket = 'raw' THEN
    RETURN QUERY EXECUTE format(
      'SELECT observed_at, value FROM price_observations
       WHERE asset_id = $1
         AND observed_at >= NOW() - INTERVAL %L
         AND observed_at <= NOW()
       ORDER BY observed_at',
      p_interval
    ) USING p_asset_id;
  ELSIF p_bucket IN ('day', 'week', 'month') THEN
    RETURN QUERY EXECUTE format(
      'SELECT date_trunc(%L, observed_at) AS observed_at,
              AVG(value)::numeric AS value
       FROM price_observations
       WHERE asset_id = $1
         AND observed_at >= NOW() - INTERVAL %L
         AND observed_at <= NOW()
       GROUP BY 1
       ORDER BY 1',
      p_bucket, p_interval
    ) USING p_asset_id;
  ELSE
    RAISE EXCEPTION 'invalid bucket: %', p_bucket;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION get_price_series(BIGINT, TEXT, TEXT) TO anon;
