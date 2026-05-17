-- Slice 11: tabella offerte mercato libero non-PLACET.
--
-- Sorgenti: REST API energiapro.biz (offerte raccolte dai commerciali DEA
-- Group) + futuri scraper sui siti dei principali brand (Enel, Edison,
-- Eni Plenitude, ecc.).
--
-- Differenza da arera_offers: arera_offers = PLACET regolamentate ARERA;
-- mercato_libero_offers = offerte commerciali fuori PLACET (promo, sconti,
-- bundle).

CREATE TABLE IF NOT EXISTS mercato_libero_offers (
  id BIGSERIAL PRIMARY KEY,
  external_id TEXT NOT NULL,         -- ID univoco nel sistema sorgente
  source TEXT NOT NULL CHECK (source IN ('energiapro_commerciali','scraping_brand_site','manual')),
  source_brand TEXT,                  -- per scraping: 'enel', 'edison', ecc.
  offer_code TEXT NOT NULL,
  offer_name TEXT,
  supplier TEXT NOT NULL,
  supplier_slug TEXT,
  supplier_logo_url TEXT,
  commodity TEXT NOT NULL CHECK (commodity IN ('electricity','gas')),
  price_type TEXT NOT NULL CHECK (price_type IN ('fisso','variabile')),
  price_value NUMERIC(12, 4) NOT NULL,
  price_unit TEXT NOT NULL CHECK (price_unit IN ('€/kWh','€/Smc')),
  customer_segment TEXT NOT NULL CHECK (customer_segment IN ('domestico','business')),
  valid_from DATE,
  valid_to DATE,
  source_url TEXT,                    -- link diretto alla pagina offerta
  notes TEXT,
  last_verified_at TIMESTAMPTZ,
  raw JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_mlo_commodity_type_segment
  ON mercato_libero_offers (commodity, price_type, customer_segment);

CREATE INDEX IF NOT EXISTS idx_mlo_supplier
  ON mercato_libero_offers (supplier_slug);

CREATE INDEX IF NOT EXISTS idx_mlo_source
  ON mercato_libero_offers (source);

-- Index on valid_to per il filtro "offerte attive". Niente WHERE clause
-- nel predicato perche' NOW()/CURRENT_DATE non sono IMMUTABLE; il planner
-- usera' comunque l'indice in combo col filtro WHERE delle RPC.
CREATE INDEX IF NOT EXISTS idx_mlo_active
  ON mercato_libero_offers (valid_to);

-- RLS: nessun anon SELECT diretto. Accesso solo via RPC SECURITY DEFINER
-- (pattern consolidato per arera_offers, forecasts, ecc.).
ALTER TABLE mercato_libero_offers ENABLE ROW LEVEL SECURITY;
