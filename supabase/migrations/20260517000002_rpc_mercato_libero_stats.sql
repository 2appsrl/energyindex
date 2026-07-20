-- Drop esplicito necessario per cambiare il return type della RPC esistente
-- get_competitor_spread_stats (aggiungiamo la colonna source).
DROP FUNCTION IF EXISTS get_competitor_spread_stats(TEXT, TEXT);

-- RPC 1: get_mercato_libero_stats — stats aggregate per la pagina /mercato-libero
-- (replica logica di percentile_cont sulle offerte attive non-PLACET).
--
-- Ritorna SEMPRE 1 row anche se il filtro non matcha (con counts a 0 e
-- NULL su percentili), cosi' la UI puo' renderizzare "dati in arrivo".

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
    p_commodity::TEXT AS commodity,
    p_price_type::TEXT AS price_type,
    p_customer_segment::TEXT AS customer_segment,
    COUNT(*)::INT AS n_total,
    COUNT(*) FILTER (WHERE mlo.source = 'energiapro_commerciali')::INT AS n_energiapro,
    COUNT(*) FILTER (WHERE mlo.source = 'scraping_brand_site')::INT AS n_scraping,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY mlo.price_value)::NUMERIC(10,4) AS p25,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY mlo.price_value)::NUMERIC(10,4) AS median,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY mlo.price_value)::NUMERIC(10,4) AS p75,
    MIN(mlo.price_value)::NUMERIC(10,4) AS best,
    CASE
      WHEN p_commodity = 'electricity' THEN '€/kWh'::TEXT
      ELSE '€/Smc'::TEXT
    END AS unit,
    MAX(mlo.recorded_at) AS last_updated
  FROM mercato_libero_offers mlo
  WHERE mlo.commodity = p_commodity
    AND mlo.price_type = p_price_type
    AND mlo.customer_segment = p_customer_segment
    AND (mlo.valid_to IS NULL OR mlo.valid_to > CURRENT_DATE);
END $$;

GRANT EXECUTE ON FUNCTION get_mercato_libero_stats(TEXT, TEXT, TEXT) TO anon, authenticated;

-- RPC 2: get_competitor_spread_stats v2 — fallback intelligente
-- per il Margin Simulator.
--
-- Strategia:
-- 1. Conta offerte attive in mercato_libero_offers per (commodity, price_type)
-- 2. Se n >= 10 -> usa mercato_libero (return source='mercato_libero')
-- 3. Altrimenti fallback su arera_offers PLACET (return source='placet_arera')
--
-- Converte sempre in EUR/MWh (moltiplica per 1000 da EUR/kWh / EUR/Smc).
-- Il segnale 'source' permette alla UI di mostrare "Fonte: ..." onestamente.

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
    AND (mlo.valid_to IS NULL OR mlo.valid_to > CURRENT_DATE);

  IF v_mlo_count >= 10 THEN
    -- Sorgente mercato_libero (preferita: offerte commerciali reali)
    RETURN QUERY
    SELECT
      p_commodity::TEXT,
      p_price_type::TEXT,
      'mercato_libero'::TEXT AS source,
      (percentile_cont(0.25) WITHIN GROUP (ORDER BY mlo.price_value) * 1000)::NUMERIC(10,2),
      (percentile_cont(0.50) WITHIN GROUP (ORDER BY mlo.price_value) * 1000)::NUMERIC(10,2),
      (percentile_cont(0.75) WITHIN GROUP (ORDER BY mlo.price_value) * 1000)::NUMERIC(10,2),
      COUNT(*)::INT
    FROM mercato_libero_offers mlo
    WHERE mlo.commodity = p_commodity
      AND mlo.price_type = p_price_type
      AND mlo.customer_segment = 'domestico'
      AND (mlo.valid_to IS NULL OR mlo.valid_to > CURRENT_DATE);
  ELSE
    -- Fallback PLACET ARERA
    RETURN QUERY
    SELECT
      p_commodity::TEXT,
      p_price_type::TEXT,
      'placet_arera'::TEXT AS source,
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
