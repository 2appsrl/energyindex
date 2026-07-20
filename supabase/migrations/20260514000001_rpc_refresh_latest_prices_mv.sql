-- Refresh della materialized view mv_latest_price_per_asset.
-- Chiamata dai job ETL dopo gli upsert per rendere i nuovi dati visibili
-- al sito senza dover aspettare un refresh manuale o un cron.
--
-- SECURITY DEFINER: si esegue con i privilegi del proprietario della
-- function (che ha permessi sulla MV), cosi' la service_role dei job
-- ETL puo' triggerare il refresh senza permessi diretti sulla MV.

CREATE OR REPLACE FUNCTION refresh_latest_prices_mv()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_latest_price_per_asset;
$$;

GRANT EXECUTE ON FUNCTION refresh_latest_prices_mv() TO authenticated, anon, service_role;
