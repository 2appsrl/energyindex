-- Slice 8 fix: get_forecast_metrics_latest deve preferire la finestra con
-- piu' osservazioni a parita' di period_end. Backfill di 365g produce 2 row
-- per (asset, horizon) — una per window 90g (spesso n=0 perche' i forecast
-- recenti non sono maturati) e una per 365g (n piu' alto). DISTINCT ON con
-- ORDER BY period_end DESC era ambiguo, sceglieva arbitrariamente.

CREATE OR REPLACE FUNCTION get_forecast_metrics_latest()
RETURNS TABLE (
  asset_id BIGINT,
  asset_slug TEXT,
  display_name_it TEXT,
  horizon_days INT,
  period_start DATE,
  period_end DATE,
  mape NUMERIC,
  rmse NUMERIC,
  hit_ratio NUMERIC,
  coverage NUMERIC,
  n_observations INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (fm.asset_id, fm.horizon_days)
    fm.asset_id,
    a.slug AS asset_slug,
    a.display_name_it,
    fm.horizon_days,
    fm.period_start,
    fm.period_end,
    fm.mape,
    fm.rmse,
    fm.hit_ratio,
    fm.coverage,
    fm.n_observations
  FROM forecast_metrics fm
  JOIN assets a ON a.id = fm.asset_id
  ORDER BY fm.asset_id, fm.horizon_days, fm.n_observations DESC, fm.period_end DESC;
$$;
