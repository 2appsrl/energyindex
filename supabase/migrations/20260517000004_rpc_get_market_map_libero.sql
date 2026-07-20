-- RPC parallela a get_market_map() ma su mercato_libero_offers (non-PLACET).
-- Ritorna le offerte commerciali attive con la mediana di categoria
-- pre-calcolata per il color delta nella visualizzazione MarketMap.
--
-- SECURITY DEFINER: mercato_libero_offers ha RLS attivo senza public-read
-- policy. La RPC bypassa RLS ed espone solo lo slice "active + domestico".

CREATE OR REPLACE FUNCTION get_market_map_libero()
RETURNS TABLE(
  offer_code TEXT,
  supplier TEXT,
  commodity TEXT,
  price_type TEXT,
  price_value NUMERIC,
  category_median NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active AS (
    SELECT
      mlo.offer_code,
      mlo.supplier,
      mlo.commodity,
      mlo.price_type,
      mlo.price_value
    FROM mercato_libero_offers mlo
    WHERE mlo.is_active = TRUE
      AND mlo.customer_segment = 'domestico'
      AND (mlo.valid_from IS NULL OR mlo.valid_from <= CURRENT_DATE)
      AND (mlo.valid_to IS NULL OR mlo.valid_to >= CURRENT_DATE)
      AND mlo.price_value IS NOT NULL
  ),
  medians AS (
    SELECT
      a.commodity,
      a.price_type,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY a.price_value) AS m
    FROM active a
    GROUP BY 1, 2
  )
  SELECT
    a.offer_code,
    a.supplier,
    a.commodity,
    a.price_type,
    a.price_value,
    m.m AS category_median
  FROM active a
  JOIN medians m ON m.commodity = a.commodity AND m.price_type = a.price_type
  ORDER BY a.commodity, a.price_type, a.price_value;
$$;

GRANT EXECUTE ON FUNCTION get_market_map_libero() TO anon, authenticated;
