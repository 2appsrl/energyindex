-- Seed asset PSV (Punto di Scambio Virtuale — hub gas wholesale italiano).
-- Geography: nazione Italia (riusa la riga geography esistente con code='IT').
-- Idempotente: ON CONFLICT su slug DO NOTHING.

INSERT INTO assets (slug, kind, commodity, unit, pricing_kind, geography_id, source, methodology_url, display_name_it)
SELECT
  'psv',
  'wholesale_index',
  'gas',
  '€/MWh',
  'absolute',
  g.id,
  'gme',
  'https://www.mercatoelettrico.org/it-it/Home/Esiti/Gas/MGP/Esiti',
  'PSV — Punto di Scambio Virtuale'
FROM geography g
WHERE g.code = 'IT' AND g.kind = 'country'
ON CONFLICT (slug) DO NOTHING;
