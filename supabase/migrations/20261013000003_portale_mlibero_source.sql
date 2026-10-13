-- Livello bulk del canale online_brand: dataset "Offerte Mercato Libero"
-- del Portale Offerte ARERA (tutte le offerte commerciali pubblicate per
-- obbligo di legge, 300+ venditori). Lo scraping diretto dei siti resta il
-- livello di freschezza. Entrambi sono contenuto Pro.

-- 1. Nuovo valore ammesso per source
ALTER TABLE mercato_libero_offers
  DROP CONSTRAINT IF EXISTS mercato_libero_offers_source_check;
ALTER TABLE mercato_libero_offers
  ADD CONSTRAINT mercato_libero_offers_source_check
  CHECK (source IN ('energiapro_commerciali','scraping_brand_site','manual','portale_mercato_libero'));

-- 2. Canale online_brand = scraping diretto + portale mercato libero
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

-- 3. La RPC pubblica demo esclude TUTTO il contenuto Pro
CREATE OR REPLACE FUNCTION get_active_mercato_libero_offers(
  p_customer_segment TEXT DEFAULT 'domestico'
)
RETURNS TABLE (
  offer_code TEXT,
  supplier TEXT,
  supplier_logo_url TEXT,
  offer_name TEXT,
  commodity TEXT,
  price_type TEXT,
  price_value NUMERIC,
  fixed_cost_monthly NUMERIC,
  customer_segment TEXT,
  source_url TEXT,
  notes TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_customer_segment NOT IN ('domestico','business') THEN
    RAISE EXCEPTION 'invalid customer_segment: %', p_customer_segment;
  END IF;

  RETURN QUERY
  SELECT
    mlo.offer_code,
    mlo.supplier,
    mlo.supplier_logo_url,
    mlo.offer_name,
    mlo.commodity,
    mlo.price_type,
    mlo.price_value,
    mlo.fixed_cost_monthly,
    mlo.customer_segment,
    mlo.source_url,
    mlo.notes
  FROM mercato_libero_offers mlo
  WHERE mlo.is_active = TRUE
    AND mlo.customer_segment = p_customer_segment
    AND mlo.source NOT IN ('scraping_brand_site','portale_mercato_libero')  -- contenuto Pro
    AND (mlo.valid_to IS NULL OR mlo.valid_to >= CURRENT_DATE)
  ORDER BY mlo.supplier, mlo.offer_name;
END $$;
