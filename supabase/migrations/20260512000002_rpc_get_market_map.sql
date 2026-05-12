-- RPC per Market Map: tutte le offerte ARERA PLACET attive oggi (domestico),
-- gia' con la mediana di categoria pre-calcolata per il color delta.
-- Evita giochini con OR/filter di Supabase JS sui timestamptz.
--
-- SECURITY DEFINER: arera_offers ha RLS attivo senza public-read policy
-- (volontariamente "interna"). La RPC bypassa RLS ed espone solo la sliced
-- view "offerte attive + domestico" — niente esposizione collaterale.

CREATE OR REPLACE FUNCTION get_market_map()
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
      ao.offer_code,
      ao.supplier,
      ao.commodity,
      ao.price_type,
      ao.price_value
    FROM arera_offers ao
    WHERE ao.valid_from <= NOW()
      AND (ao.valid_to IS NULL OR ao.valid_to >= NOW())
      AND ao.raw->>'tipo_cliente' = 'domestico'
      AND ao.price_value IS NOT NULL
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

GRANT EXECUTE ON FUNCTION get_market_map() TO anon;
