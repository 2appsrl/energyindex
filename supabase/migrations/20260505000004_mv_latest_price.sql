-- Materialized view: ultima riga di price_observations per ogni asset
CREATE MATERIALIZED VIEW mv_latest_price_per_asset AS
SELECT DISTINCT ON (po.asset_id)
  po.asset_id,
  a.slug AS asset_slug,
  a.display_name_it,
  a.unit,
  a.commodity,
  a.pricing_kind,
  po.observed_at,
  po.value,
  po.recorded_at
FROM price_observations po
JOIN assets a ON a.id = po.asset_id
ORDER BY po.asset_id, po.observed_at DESC;

-- Index unico necessario per REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_latest_price_asset ON mv_latest_price_per_asset(asset_id);
CREATE INDEX idx_mv_latest_price_slug ON mv_latest_price_per_asset(asset_slug);

-- RLS: la materialized view non supporta RLS direttamente.
-- Workaround: GRANT esplicito su anon.
GRANT SELECT ON mv_latest_price_per_asset TO anon;
GRANT SELECT ON mv_latest_price_per_asset TO authenticated;

-- Funzione di refresh chiamabile da Edge Functions
CREATE OR REPLACE FUNCTION refresh_latest_price_view()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_latest_price_per_asset;
END;
$$;

-- Permesso di chiamare la funzione: solo service_role.
REVOKE EXECUTE ON FUNCTION refresh_latest_price_view() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_latest_price_view() TO service_role;
