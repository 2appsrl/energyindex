-- PUN nazionale + 6 zonali
INSERT INTO assets (slug, kind, commodity, unit, geography_id, source, display_name_it, methodology_url)
SELECT 'pun', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme',
       'PUN — Prezzo Unico Nazionale',
       'https://www.mercatoelettrico.org/it-it/Home/Esiti/Elettricita/MGP/Esiti/PUN'
FROM geography g WHERE g.code = 'IT'
UNION ALL
SELECT 'pun-zona-nord', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme', 'PUN Zona Nord', NULL
FROM geography g WHERE g.code = 'IT-NORD'
UNION ALL
SELECT 'pun-zona-cnor', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme', 'PUN Zona Centro-Nord', NULL
FROM geography g WHERE g.code = 'IT-CNOR'
UNION ALL
SELECT 'pun-zona-csud', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme', 'PUN Zona Centro-Sud', NULL
FROM geography g WHERE g.code = 'IT-CSUD'
UNION ALL
SELECT 'pun-zona-sud', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme', 'PUN Zona Sud', NULL
FROM geography g WHERE g.code = 'IT-SUD'
UNION ALL
SELECT 'pun-zona-sici', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme', 'PUN Zona Sicilia', NULL
FROM geography g WHERE g.code = 'IT-SICI'
UNION ALL
SELECT 'pun-zona-sard', 'wholesale_index', 'electricity', '€/MWh', g.id, 'gme', 'PUN Zona Sardegna', NULL
FROM geography g WHERE g.code = 'IT-SARD'
ON CONFLICT (slug) DO NOTHING;
