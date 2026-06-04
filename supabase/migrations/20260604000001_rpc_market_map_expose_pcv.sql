-- Aggiunge pcv_eur_anno alle 2 RPC della Market Map per alimentare il
-- nuovo tool "Calcola la tua bolletta" sotto la mappa.
--
-- Sorgenti:
--  - PLACET: arera_offers.raw->'quota_fissa_eur_anno' (gia' EUR/anno)
--  - libero: mercato_libero_offers.fixed_cost_monthly * 12

DROP FUNCTION IF EXISTS get_market_map();
CREATE FUNCTION get_market_map()
RETURNS TABLE(
  offer_code TEXT,
  supplier TEXT,
  commodity TEXT,
  price_type TEXT,
  price_value NUMERIC,
  category_median NUMERIC,
  pcv_eur_anno NUMERIC
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
      ao.price_value,
      COALESCE((ao.raw->>'quota_fissa_eur_anno')::NUMERIC, 0) AS pcv_eur_anno
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
    m.m AS category_median,
    a.pcv_eur_anno
  FROM active a
  JOIN medians m ON m.commodity = a.commodity AND m.price_type = a.price_type
  ORDER BY a.commodity, a.price_type, a.price_value;
$$;
GRANT EXECUTE ON FUNCTION get_market_map() TO anon, authenticated;

DROP FUNCTION IF EXISTS get_market_map_libero();
CREATE FUNCTION get_market_map_libero()
RETURNS TABLE(
  offer_code TEXT,
  supplier TEXT,
  commodity TEXT,
  price_type TEXT,
  price_value NUMERIC,
  category_median NUMERIC,
  creator_role TEXT,
  source TEXT,
  pcv_eur_anno NUMERIC
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
      mlo.price_value,
      mlo.creator_role,
      mlo.source,
      COALESCE(mlo.fixed_cost_monthly * 12, 0) AS pcv_eur_anno
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
    m.m AS category_median,
    a.creator_role,
    a.source,
    a.pcv_eur_anno
  FROM active a
  JOIN medians m ON m.commodity = a.commodity AND m.price_type = a.price_type
  ORDER BY a.commodity, a.price_type, a.price_value;
$$;
GRANT EXECUTE ON FUNCTION get_market_map_libero() TO anon, authenticated;
