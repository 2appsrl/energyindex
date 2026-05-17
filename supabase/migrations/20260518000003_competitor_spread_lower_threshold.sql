-- Abbassa la soglia di fallback in get_competitor_spread_stats da 10 a 3:
-- con 9 offerte electricity variabili in mercato_libero, il benchmark
-- mostrava ancora "Fonte: PLACET ARERA" (483 offerte standardizzate
-- regolate). Le offerte commerciali reali sono piu' rappresentative del
-- mercato vero, anche con sample piccolo. Soglia 3 = minimo statisticamente
-- decente per percentili p25/median/p75.
--
-- Risultato dopo apply: source 'mercato_libero', mediano spread variabile
-- electricity ~15.30 EUR/MWh (vs 60 EUR/MWh PLACET).

CREATE OR REPLACE FUNCTION get_competitor_spread_stats(
  p_commodity TEXT,
  p_price_type TEXT
)
RETURNS TABLE (
  commodity TEXT,
  price_type TEXT,
  source TEXT,
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
DECLARE
  v_mlo_count INT;
BEGIN
  IF p_commodity NOT IN ('electricity','gas') THEN
    RAISE EXCEPTION 'invalid commodity: %', p_commodity;
  END IF;
  IF p_price_type NOT IN ('fisso','variabile') THEN
    RAISE EXCEPTION 'invalid price_type: %', p_price_type;
  END IF;

  SELECT COUNT(*) INTO v_mlo_count
  FROM mercato_libero_offers mlo
  WHERE mlo.commodity = p_commodity
    AND mlo.price_type = p_price_type
    AND mlo.customer_segment = 'domestico'
    AND mlo.is_active = TRUE
    AND (mlo.valid_to IS NULL OR mlo.valid_to > CURRENT_DATE);

  IF v_mlo_count >= 3 THEN
    RETURN QUERY
    SELECT
      p_commodity::TEXT,
      p_price_type::TEXT,
      'mercato_libero'::TEXT,
      (percentile_cont(0.25) WITHIN GROUP (ORDER BY mlo.price_value) * 1000)::NUMERIC(10,2),
      (percentile_cont(0.50) WITHIN GROUP (ORDER BY mlo.price_value) * 1000)::NUMERIC(10,2),
      (percentile_cont(0.75) WITHIN GROUP (ORDER BY mlo.price_value) * 1000)::NUMERIC(10,2),
      COUNT(*)::INT
    FROM mercato_libero_offers mlo
    WHERE mlo.commodity = p_commodity
      AND mlo.price_type = p_price_type
      AND mlo.customer_segment = 'domestico'
      AND mlo.is_active = TRUE
      AND (mlo.valid_to IS NULL OR mlo.valid_to > CURRENT_DATE);
  ELSE
    RETURN QUERY
    SELECT
      p_commodity::TEXT,
      p_price_type::TEXT,
      'placet_arera'::TEXT,
      (percentile_cont(0.25) WITHIN GROUP (ORDER BY ao.price_value) * 1000)::NUMERIC(10,2),
      (percentile_cont(0.50) WITHIN GROUP (ORDER BY ao.price_value) * 1000)::NUMERIC(10,2),
      (percentile_cont(0.75) WITHIN GROUP (ORDER BY ao.price_value) * 1000)::NUMERIC(10,2),
      COUNT(*)::INT
    FROM arera_offers ao
    WHERE ao.commodity = p_commodity
      AND ao.price_type = p_price_type
      AND (ao.valid_to IS NULL OR ao.valid_to > NOW());
  END IF;
END $$;
