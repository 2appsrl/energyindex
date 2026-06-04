-- DROP necessario per modificare RETURNS TABLE (PostgreSQL non permette
-- l'aggiunta di colonne con CREATE OR REPLACE su funzioni esistenti).
--
-- Aggiunge creator_role e source alla RETURNS TABLE per permettere il filtro
-- UI "Tutte / Certificate / Non certificate" sulla Market Map.
--
-- Nota: NON modifichiamo i filtri WHERE (continuiamo a mostrare tutte le
-- offerte attive); il filtro per creator_role e' applicato client-side cosi'
-- la mediana di categoria resta calcolata sull'universo completo (altrimenti
-- 2 mediane diverse per Certificate/Non, confondente per UX).

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
  source TEXT
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
      mlo.source
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
    a.source
  FROM active a
  JOIN medians m ON m.commodity = a.commodity AND m.price_type = a.price_type
  ORDER BY a.commodity, a.price_type, a.price_value;
$$;

GRANT EXECUTE ON FUNCTION get_market_map_libero() TO anon, authenticated;
