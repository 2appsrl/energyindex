-- Slice 7 Driver di mercato - pre-step + 3 nuovi asset.
--
-- 1) Estende i CHECK constraints di assets per i nuovi driver:
--    - kind:      aggiungo 'driver' (indicatori non-mercato-tradizionale)
--    - commodity: aggiungo 'oil', 'co2', 'temperature'
--    - source:    aggiungo 'eia' (Brent), 'ember' (CO2), 'open-meteo' (temp)
--
-- 2) Aggiunge geography 'WORLD' per Brent (petrolio globale).
--    CO2 -> EU (id=1, gia' esistente); Temperatura -> IT (id=2, gia' esistente).
--
-- 3) Inserisce i 3 nuovi asset.

ALTER TABLE assets DROP CONSTRAINT assets_kind_check;
ALTER TABLE assets ADD CONSTRAINT assets_kind_check
  CHECK (kind = ANY (ARRAY['wholesale_index','country_dayahead','retail_aggregate','driver']));

ALTER TABLE assets DROP CONSTRAINT assets_commodity_check;
ALTER TABLE assets ADD CONSTRAINT assets_commodity_check
  CHECK (commodity = ANY (ARRAY['electricity','gas','oil','co2','temperature']));

ALTER TABLE assets DROP CONSTRAINT assets_source_check;
ALTER TABLE assets ADD CONSTRAINT assets_source_check
  CHECK (source = ANY (ARRAY['gme','entsoe','arera','computed','eia','ember','open-meteo']));

INSERT INTO geography (kind, code, name_it, name_en, parent_id)
VALUES ('continent','WORLD','Mondo','World',NULL)
ON CONFLICT (code) DO NOTHING;

INSERT INTO assets (slug, kind, commodity, unit, pricing_kind, geography_id, source, display_name_it)
VALUES
  ('brent',          'driver', 'oil',         '$/bbl',  'absolute',
    (SELECT id FROM geography WHERE code='WORLD'), 'eia',         'Brent — Petrolio greggio'),
  ('co2',            'driver', 'co2',         '€/tCO2', 'absolute',
    (SELECT id FROM geography WHERE code='EU'),    'ember',       'CO2 — Quota emissione EU ETS'),
  ('temperatura-it', 'driver', 'temperature', '°C',     'absolute',
    (SELECT id FROM geography WHERE code='IT'),    'open-meteo',  'Temperatura Italia (media naz.)')
ON CONFLICT (slug) DO NOTHING;
