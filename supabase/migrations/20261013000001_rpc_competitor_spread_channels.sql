-- Benchmark competitor a 3 canali: sostituisce (affiancandola, per
-- retrocompatibilita') la logica a fallback di get_competitor_spread_stats.
-- Ogni canale riporta i SUOI percentili, sempre 3 righe:
--   placet_arera  → arera_offers (Portale Offerte ARERA, PLACET)
--   energiapro    → mercato_libero_offers, source energiapro_commerciali/manual
--   online_brand  → mercato_libero_offers, source scraping_brand_site
-- Percentili NULL + n_offerte=0 quando il canale e' vuoto (es. online_brand
-- finche' lo scraper brand non e' in produzione): la UI mostra "in costruzione".
-- Prezzi: price_value e' in EUR/kWh (o EUR/Smc) → *1000 per EUR/MWh, come
-- nella RPC esistente.

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
    AND mlo.source = 'scraping_brand_site'
    AND mlo.is_active = TRUE
    AND (mlo.valid_to IS NULL OR mlo.valid_to > CURRENT_DATE);
END $$;
