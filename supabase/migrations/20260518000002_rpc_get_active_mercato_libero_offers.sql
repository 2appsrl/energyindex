-- RPC dedicata al Customer Simulator: ritorna tutte le offerte attive
-- domestico (o business in futuro) mercato libero, con tutti i campi
-- necessari per il ranking client-side: price_value, fixed_cost_monthly,
-- supplier info, ecc.
--
-- mercato_libero_offers ha RLS enabled senza policy public, quindi
-- senza questa RPC SECURITY DEFINER il client anon vedrebbe 0 rows.

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
    AND (mlo.valid_to IS NULL OR mlo.valid_to >= CURRENT_DATE)
  ORDER BY mlo.supplier, mlo.offer_name;
END $$;

GRANT EXECUTE ON FUNCTION get_active_mercato_libero_offers(TEXT) TO anon, authenticated;
