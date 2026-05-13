-- Calcola anomalia termica stagionale: differenza fra il valore di p_date
-- e la media dei valori dello stesso giorno-mese negli ultimi 5 anni.
--
-- Esempio: p_date = 2026-05-13
--   value          = T del 2026-05-13
--   baseline_avg   = AVG(T del 2021-05-13, ..., T del 2025-05-13)
--   anomaly        = value - baseline_avg
--   baseline_years = quanti anni effettivi sono entrati nella baseline (per UI fallback)
--
-- Se baseline_years < 3, il chiamante dovrebbe nascondere l'anomalia (dato troppo scarno).

CREATE OR REPLACE FUNCTION get_temperature_anomaly(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  value NUMERIC,
  baseline_avg NUMERIC,
  anomaly NUMERIC,
  baseline_years INT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH curr AS (
    SELECT po.value
    FROM price_observations po
    JOIN assets a ON a.id = po.asset_id
    WHERE a.slug = 'temperatura-it'
      AND DATE(po.observed_at) = p_date
    ORDER BY po.observed_at DESC
    LIMIT 1
  ),
  baseline AS (
    SELECT AVG(po.value) AS avg_value, COUNT(*) AS n
    FROM price_observations po
    JOIN assets a ON a.id = po.asset_id
    WHERE a.slug = 'temperatura-it'
      AND EXTRACT(MONTH FROM po.observed_at) = EXTRACT(MONTH FROM p_date)
      AND EXTRACT(DAY FROM po.observed_at) = EXTRACT(DAY FROM p_date)
      AND po.observed_at < p_date::timestamp
      AND po.observed_at >= (p_date - INTERVAL '5 years')::timestamp
  )
  SELECT
    c.value,
    b.avg_value,
    c.value - b.avg_value AS anomaly,
    b.n::int AS baseline_years
  FROM curr c, baseline b;
$$;

GRANT EXECUTE ON FUNCTION get_temperature_anomaly(DATE) TO anon, authenticated;
