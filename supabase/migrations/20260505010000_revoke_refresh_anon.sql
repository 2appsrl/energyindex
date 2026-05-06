-- Hotfix sicurezza: la migrazione 20260505000004 aveva
--   REVOKE EXECUTE ON FUNCTION refresh_latest_price_view() FROM PUBLIC;
--   GRANT EXECUTE ... TO service_role;
-- ma su Supabase managed Postgres anon/authenticated ricevono EXECUTE
-- via ALTER DEFAULT PRIVILEGES a livello di ruolo (non tramite PUBLIC).
-- Quindi anon poteva invocare la funzione via PostgREST -> DoS vector.
-- Qui revochiamo esplicitamente.

REVOKE EXECUTE ON FUNCTION refresh_latest_price_view() FROM anon, authenticated;

-- Hygiene aggiuntiva: la materialized view ha ricevuto privilegi DML
-- (INSERT/UPDATE/DELETE/TRUNCATE) di default a anon/authenticated.
-- Su MV questi DML non sono comunque eseguibili (sono read-only via PostgREST),
-- ma per principio di least privilege li togliamo esplicitamente.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON mv_latest_price_per_asset FROM anon, authenticated;
