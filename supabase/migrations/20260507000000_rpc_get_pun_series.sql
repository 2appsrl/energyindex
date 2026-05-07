-- RPC per chart PUN bucketato. Letta da anon via supabase-js .rpc().
-- p_bucket: 'month' | 'day' | 'raw'
-- p_interval: literal accettato da NOW() - INTERVAL '<x>' (es. '5 years', '30 days')
CREATE OR REPLACE FUNCTION get_pun_series(
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
  ELSIF p_bucket IN ('day', 'month') THEN
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

GRANT EXECUTE ON FUNCTION get_pun_series(BIGINT, TEXT, TEXT) TO anon;
