-- Slice 11 Wave 2: colonne per il soft-delete dopo sync e tracking ultimo sync.
--
-- is_active: false quando l'offerta non e' piu' presente nella response API
--            (es. supplier l'ha tolta dal catalogo). La RPC delle stats
--            filtra is_active = TRUE.
-- synced_at: timestamp ultimo sync da API (utile per debug / "data freshness").
--
-- Backfill: tutte le righe esistenti (al momento 0) avranno is_active=true.

ALTER TABLE mercato_libero_offers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mlo_active_flag
  ON mercato_libero_offers (is_active)
  WHERE is_active = TRUE;

-- Update get_mercato_libero_stats e get_competitor_spread_stats per filtrare
-- anche su is_active = TRUE (oltre al filtro valid_to esistente).

CREATE OR REPLACE FUNCTION get_mercato_libero_stats(
  p_commodity TEXT,
  p_price_type TEXT,
  p_customer_segment TEXT DEFAULT 'domestico'
)
RETURNS TABLE (
  commodity TEXT,
  price_type TEXT,
  customer_segment TEXT,
  n_total INT,
  n_energiapro INT,
  n_scraping INT,
  p25 NUMERIC,
  median NUMERIC,
  p75 NUMERIC,
  best NUMERIC,
  unit TEXT,
  last_updated TIMESTAMPTZ
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
  IF p_customer_segment NOT IN ('domestico','business') THEN
    RAISE EXCEPTION 'invalid customer_segment: %', p_customer_segment;
  END IF;

  RETURN QUERY
  SELECT
    p_commodity::TEXT,
    p_price_type::TEXT,
    p_customer_segment::TEXT,
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE mlo.source = 'energiapro_commerciali')::INT,
    COUNT(*) FILTER (WHERE mlo.source = 'scraping_brand_site')::INT,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY mlo.price_value)::NUMERIC(10,4),
    percentile_cont(0.50) WITHIN GROUP (ORDER BY mlo.price_value)::NUMERIC(10,4),
    percentile_cont(0.75) WITHIN GROUP (ORDER BY mlo.price_value)::NUMERIC(10,4),
    MIN(mlo.price_value)::NUMERIC(10,4),
    CASE WHEN p_commodity = 'electricity' THEN '€/kWh'::TEXT ELSE '€/Smc'::TEXT END,
    MAX(mlo.recorded_at)
  FROM mercato_libero_offers mlo
  WHERE mlo.commodity = p_commodity
    AND mlo.price_type = p_price_type
    AND mlo.customer_segment = p_customer_segment
    AND mlo.is_active = TRUE
    AND (mlo.valid_to IS NULL OR mlo.valid_to > CURRENT_DATE);
END $$;

DROP FUNCTION IF EXISTS get_competitor_spread_stats(TEXT, TEXT);

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

  IF v_mlo_count >= 10 THEN
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

GRANT EXECUTE ON FUNCTION get_competitor_spread_stats(TEXT, TEXT) TO anon, authenticated;
