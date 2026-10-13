-- Le offerte scrapate dai siti brand (source='scraping_brand_site') sono
-- contenuto Pro: NON devono uscire dalla RPC pubblica usata dal Customer
-- Simulator demo. Il canale resta visibile solo come aggregato (percentili
-- in get_competitor_spread_stats_channels) e l'elenco offerte completo sara'
-- servito da una RPC dedicata quando esistera' l'auth a tier.

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
    AND mlo.source <> 'scraping_brand_site'   -- contenuto Pro, escluso dalla demo
    AND (mlo.valid_to IS NULL OR mlo.valid_to >= CURRENT_DATE)
  ORDER BY mlo.supplier, mlo.offer_name;
END $$;
