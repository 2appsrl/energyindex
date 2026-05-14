-- Slice 8 — refinement schema dei forecast post-review.
--
-- 1) Enable RLS sui forecast e forecast_metrics. Nessuna policy: l'accesso
--    passa solo via RPC SECURITY DEFINER (pattern consolidato per
--    arera_offers/etl_runs).
-- 2) Drop indice idx_forecasts_asset_horizon_date: nessuna query del plan
--    usa l'ordinamento (asset_id, horizon_days, forecast_date DESC).
--    idx_forecasts_latest_per_asset_horizon copre i query patterns esistenti.
-- 3) Slarga model_version VARCHAR(20) -> TEXT per future versioni
--    "ensemble-ridge-rf-v3.2" che eccedono 20 caratteri.
-- 4) Slarga mape NUMERIC(6,3) -> NUMERIC(9,3) per evitare numeric overflow
--    durante bootstrap o regressioni modello (MAPE > 999.999%).

ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_metrics ENABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS idx_forecasts_asset_horizon_date;

ALTER TABLE forecasts ALTER COLUMN model_version TYPE TEXT;
ALTER TABLE forecast_metrics ALTER COLUMN mape TYPE NUMERIC(9, 3);
