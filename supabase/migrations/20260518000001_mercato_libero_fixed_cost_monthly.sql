-- Aggiunge fixed_cost_monthly al schema mercato_libero_offers.
-- Rappresenta il "costo commercializzazione e vendita" fisso mensile,
-- separato dal price_value (che e' per-kWh o per-Smc + per variabile
-- e' lo spread sopra PUN/PSV). E' fondamentale per il calcolo del
-- costo bolletta totale: total = price * volume + fixed_cost_monthly * 12.

ALTER TABLE mercato_libero_offers
  ADD COLUMN IF NOT EXISTS fixed_cost_monthly NUMERIC(8, 2);

COMMENT ON COLUMN mercato_libero_offers.fixed_cost_monthly IS
  'Costo commercializzazione e vendita fisso mensile (EUR/mese). Separato dal price_value (per-kWh / per-Smc).';

-- Aggiorna RPC get_mercato_libero_stats: aggiunge mediana / p25 / p75
-- del fixed_cost_monthly tra i campi di output. Cosi' le mini card UI
-- possono mostrare "spread X EUR/kWh + Y EUR/mese fisso".
--
-- DROP esplicito perche' stiamo cambiando il return type (aggiunte
-- 3 colonne fixed_cost_*).

DROP FUNCTION IF EXISTS get_mercato_libero_stats(TEXT, TEXT, TEXT);

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
  fixed_cost_p25 NUMERIC,
  fixed_cost_median NUMERIC,
  fixed_cost_p75 NUMERIC,
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
    percentile_cont(0.25) WITHIN GROUP (ORDER BY mlo.fixed_cost_monthly)::NUMERIC(8,2),
    percentile_cont(0.50) WITHIN GROUP (ORDER BY mlo.fixed_cost_monthly)::NUMERIC(8,2),
    percentile_cont(0.75) WITHIN GROUP (ORDER BY mlo.fixed_cost_monthly)::NUMERIC(8,2),
    CASE WHEN p_commodity = 'electricity' THEN '€/kWh'::TEXT ELSE '€/Smc'::TEXT END,
    MAX(mlo.recorded_at)
  FROM mercato_libero_offers mlo
  WHERE mlo.commodity = p_commodity
    AND mlo.price_type = p_price_type
    AND mlo.customer_segment = p_customer_segment
    AND mlo.is_active = TRUE
    AND (mlo.valid_to IS NULL OR mlo.valid_to > CURRENT_DATE);
END $$;
