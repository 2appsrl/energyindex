-- Continenti
INSERT INTO geography (kind, code, name_it, name_en) VALUES
  ('continent', 'EU', 'Europa', 'Europe')
ON CONFLICT (code) DO NOTHING;

-- Country IT
INSERT INTO geography (kind, code, name_it, name_en, parent_id, geojson_ref)
SELECT 'country', 'IT', 'Italia', 'Italy', g.id, 'italy'
FROM geography g WHERE g.code = 'EU'
ON CONFLICT (code) DO NOTHING;

-- 6 Zone MGP italiane (figlie di IT)
INSERT INTO geography (kind, code, name_it, name_en, parent_id, geojson_ref)
SELECT 'zone', 'IT-NORD', 'Nord', 'North', g.id, 'mgp-zone-nord' FROM geography g WHERE g.code = 'IT'
UNION ALL
SELECT 'zone', 'IT-CNOR', 'Centro-Nord', 'Central-North', g.id, 'mgp-zone-cnor' FROM geography g WHERE g.code = 'IT'
UNION ALL
SELECT 'zone', 'IT-CSUD', 'Centro-Sud', 'Central-South', g.id, 'mgp-zone-csud' FROM geography g WHERE g.code = 'IT'
UNION ALL
SELECT 'zone', 'IT-SUD', 'Sud', 'South', g.id, 'mgp-zone-sud' FROM geography g WHERE g.code = 'IT'
UNION ALL
SELECT 'zone', 'IT-SICI', 'Sicilia', 'Sicily', g.id, 'mgp-zone-sici' FROM geography g WHERE g.code = 'IT'
UNION ALL
SELECT 'zone', 'IT-SARD', 'Sardegna', 'Sardinia', g.id, 'mgp-zone-sard' FROM geography g WHERE g.code = 'IT'
ON CONFLICT (code) DO NOTHING;
