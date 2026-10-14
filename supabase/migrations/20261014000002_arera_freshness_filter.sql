-- Filtro freschezza PLACET in lettura (niente mutazioni di massa):
-- un'offerta arera_offers e' "attiva" solo se vista in un ingest recente,
-- cioe' last_seen_at >= MAX(last_seen_at) - 3 giorni. L'ancora e' l'ultimo
-- ingest (non NOW()): se il cron si rompe il catalogo non si svuota, resta
-- l'ultima fotografia valida. Le righe mai riviste (zombie del buco
-- mag→ott 2026, last_seen_at NULL) sono escluse appena esiste un ingest
-- con last_seen_at valorizzato.
--
-- RPC aggiornate: get_competitor_spread_stats_channels (ramo placet),
-- get_market_map (ticker pubblico PLACET), get_competitor_spread_stats
-- (legacy, ancora esposta).

CREATE OR REPLACE FUNCTION arera_freshness_cutoff()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT MAX(last_seen_at) - INTERVAL '3 days' FROM arera_offers;
$$;

-- ============================================================
-- 1. Benchmark a 3 canali
-- ============================================================
CREATE OR REPLACE FUNCTION get_competitor_spread_stats_channels(
  p_commodity TEXT,
  p_price_type TEXT
)
RETURNS TABLE (
  channel TEXT,
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
  IF p_commodity NOT IN ('electricity','gas') THEN
    RAISE EXCEPTION 'invalid commodity: %', p_commodity;
  END IF;
  IF p_price_type NOT IN ('fisso','variabile') THEN
    RAISE EXCEPTION 'invalid price_type: %', p_price_type;
  END IF;

  RETURN QUERY
  SELECT
    'placet_arera'::TEXT,
    (percentile_cont(0.25) WITHIN GROUP (ORDER BY ao.price_value) * 1000)::NUMERIC(10,2),
    (percentile_cont(0.50) WITHIN GROUP (ORDER BY ao.price_value) * 1000)::NUMERIC(10,2),
    (percentile_cont(0.75) WITHIN GROUP (ORDER BY ao.price_value) * 1000)::NUMERIC(10,2),
    COUNT(*)::INT
  FROM arera_offers ao
  WHERE ao.commodity = p_commodity
    AND ao.price_type = p_price_type
    AND (ao.valid_to IS NULL OR ao.valid_to > NOW())
    AND ao.last_seen_at >= arera_freshness_cutoff()

  UNION ALL

  SELECT
    'energiapro'::TEXT,
    (percentile_cont(0.25) WITHIN GROUP (ORDER BY mlo.price_value) * 1000)::NUMERIC(10,2),
    (percentile_cont(0.50) WITHIN GROUP (ORDER BY mlo.price_value) * 1000)::NUMERIC(10,2),
    (percentile_cont(0.75) WITHIN GROUP (ORDER BY mlo.price_value) * 1000)::NUMERIC(10,2),
    COUNT(*)::INT
  FROM mercato_libero_offers mlo
  WHERE mlo.commodity = p_commodity
    AND mlo.price_type = p_price_type
    AND mlo.customer_segment = 'domestico'
    AND mlo.source IN ('energiapro_commerciali','manual')
    AND mlo.is_active = TRUE
    AND (mlo.valid_to IS NULL OR mlo.valid_to > CURRENT_DATE)

  UNION ALL

  SELECT
    'online_brand'::TEXT,
    (percentile_cont(0.25) WITHIN GROUP (ORDER BY mlo.price_value) * 1000)::NUMERIC(10,2),
    (percentile_cont(0.50) WITHIN GROUP (ORDER BY mlo.price_value) * 1000)::NUMERIC(10,2),
    (percentile_cont(0.75) WITHIN GROUP (ORDER BY mlo.price_value) * 1000)::NUMERIC(10,2),
    COUNT(*)::INT
  FROM mercato_libero_offers mlo
  WHERE mlo.commodity = p_commodity
    AND mlo.price_type = p_price_type
    AND mlo.customer_segment = 'domestico'
    AND mlo.source IN ('scraping_brand_site','portale_mercato_libero')
    AND mlo.is_active = TRUE
    AND (mlo.valid_to IS NULL OR mlo.valid_to > CURRENT_DATE);
END $$;

-- ============================================================
-- 2. Market map PLACET (ticker pubblico)
-- ============================================================
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
      AND ao.last_seen_at >= arera_freshness_cutoff()
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

-- ============================================================
-- 3. RPC legacy a fallback (ramo PLACET)
-- ============================================================
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
    AND mlo.source IN ('energiapro_commerciali','manual')
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
      AND mlo.source IN ('energiapro_commerciali','manual')
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
      AND (ao.valid_to IS NULL OR ao.valid_to > NOW())
      AND ao.last_seen_at >= arera_freshness_cutoff();
  END IF;
END $$;
