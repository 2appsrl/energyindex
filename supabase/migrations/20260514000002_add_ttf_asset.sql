-- Slice 7.5 — TTF Forward (Dutch Title Transfer Facility, gas EU benchmark).
-- Fonte: Yahoo Finance API non ufficiale, simbolo TTF=F (front-month future
-- quotato anche su NYMEX, traccia ICE Endex Europa).

-- 1. Estendi CHECK constraint source per accomodare 'yahoo'.
ALTER TABLE assets DROP CONSTRAINT assets_source_check;
ALTER TABLE assets ADD CONSTRAINT assets_source_check
  CHECK (source = ANY (ARRAY['gme','entsoe','arera','computed','eia','ember','open-meteo','yahoo']));

-- 2. Inserisci asset TTF (geography EU, gia' esistente id=1).
INSERT INTO assets (slug, kind, commodity, unit, pricing_kind, geography_id, source, display_name_it)
VALUES
  ('ttf', 'driver', 'gas', '€/MWh', 'absolute',
   (SELECT id FROM geography WHERE code='EU'), 'yahoo',
   'TTF — Gas Europa (front-month)')
ON CONFLICT (slug) DO NOTHING;
