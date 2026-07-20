-- Slice 9 Margin Simulator: stats spread offerte mercato per il benchmark
-- competitor. Convertiamo €/kWh -> €/MWh per coerenza con lo spread vendita
-- usato dall'UI.

CREATE OR REPLACE FUNCTION get_competitor_spread_stats(
  p_commodity TEXT,
  p_price_type TEXT
)
RETURNS TABLE (
  commodity TEXT,
  price_type TEXT,
  p25_eur_mwh NUMERIC,
  median_eur_mwh NUMERIC,
  p75_eur_mwh NUMERIC,
  n_offerte INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_commodity NOT IN ('electricity', 'gas') THEN
    RAISE EXCEPTION 'invalid commodity: % (must be electricity|gas)', p_commodity;
  END IF;
  IF p_price_type NOT IN ('fisso', 'variabile') THEN
    RAISE EXCEPTION 'invalid price_type: % (must be fisso|variabile)', p_price_type;
  END IF;

  RETURN QUERY
  SELECT
    p_commodity::TEXT AS commodity,
    p_price_type::TEXT AS price_type,
    (percentile_cont(0.25) WITHIN GROUP (ORDER BY ao.price_value) * 1000)::NUMERIC(10,2) AS p25_eur_mwh,
    (percentile_cont(0.50) WITHIN GROUP (ORDER BY ao.price_value) * 1000)::NUMERIC(10,2) AS median_eur_mwh,
    (percentile_cont(0.75) WITHIN GROUP (ORDER BY ao.price_value) * 1000)::NUMERIC(10,2) AS p75_eur_mwh,
    COUNT(*)::INT AS n_offerte
  FROM arera_offers ao
  WHERE ao.commodity = p_commodity
    AND ao.price_type = p_price_type
    AND (ao.valid_to IS NULL OR ao.valid_to > NOW());
END $$;

GRANT EXECUTE ON FUNCTION get_competitor_spread_stats(TEXT, TEXT) TO anon, authenticated;
