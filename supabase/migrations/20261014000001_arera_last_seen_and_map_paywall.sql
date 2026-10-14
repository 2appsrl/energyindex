-- Due fix di correttezza dati scoperti il 14/10/2026:
--
-- 1. ZOMBIE PLACET: arera_offers non scade mai le offerte sparite dal file
--    giornaliero (upsert su offer_code+valid_from, molte righe con
--    valid_to NULL). Dopo il buco di ingest mag→ott 2026 (il portale ha
--    iniziato a rispondere 403 ai runner GitHub e il cron "passava" con 0
--    righe) le offerte di maggio risultavano ancora attive accanto a
--    quelle fresche. Fix: colonna last_seen_at, valorizzata dal backfill a
--    ogni ingest; lo script chiude (valid_to=NOW) le attive non riviste.
--
-- 2. PAYWALL LEAK: get_market_map_libero (ticker pubblico) esponeva tutte
--    le fonti di mercato_libero_offers, comprese quelle Pro
--    (scraping_brand_site, portale_mercato_libero). Fix: whitelist.

ALTER TABLE arera_offers ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_arera_offers_last_seen
  ON arera_offers (last_seen_at);

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
      -- contenuto Pro escluso dalla mappa pubblica
      AND mlo.source IN ('energiapro_commerciali','manual')
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
