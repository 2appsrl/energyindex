-- Scheda "Integrazioni" della dashboard admin: chi usa il widget, chi chiama
-- le API senza chiave (lead) e quante chiamate fa ogni chiave. Aggregazioni
-- lato DB per non scaricare righe di traffic_log nel server Next.
-- Come le altre funzioni admin: SECURITY DEFINER, eseguibili solo da service_role.
-- Dai domini sono esclusi i nostri host (sito, sito e anteprime Netlify di
-- questo progetto, sviluppo locale). Gli altri *.netlify.app restano: sono siti
-- di terzi che usano widget o API.

-- Domini da cui viene caricato il widget (chiamate API con ?src=widget).
CREATE OR REPLACE FUNCTION admin_widget_domains(p_days INT)
RETURNS TABLE (origin_host TEXT, requests BIGINT, uniques BIGINT, first_seen TIMESTAMPTZ, last_seen TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.origin_host, count(*), count(DISTINCT t.ip_hash), min(t.ts), max(t.ts)
  FROM traffic_log t
  WHERE t.kind = 'api'
    AND t.ts >= now() - make_interval(days => p_days)
    AND t.origin_host IS NOT NULL
    AND t.origin_host NOT IN ('energyindex.it', 'www.energyindex.it', 'energyindex.pro', 'www.energyindex.pro')
    AND t.origin_host <> 'energyindex.netlify.app'
    AND t.origin_host NOT LIKE '%--energyindex.netlify.app'
    AND split_part(t.origin_host, ':', 1) NOT IN ('localhost', '127.0.0.1')
    AND t.query ILIKE '%src=widget%'
  GROUP BY t.origin_host
  ORDER BY 2 DESC
  LIMIT 200;
$$;

-- Siti che chiamano le API dal browser senza chiave e non tramite il widget:
-- sono i candidati a cui proporre una chiave.
CREATE OR REPLACE FUNCTION admin_keyless_api_domains(p_days INT)
RETURNS TABLE (origin_host TEXT, requests BIGINT, uniques BIGINT, first_seen TIMESTAMPTZ, last_seen TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.origin_host, count(*), count(DISTINCT t.ip_hash), min(t.ts), max(t.ts)
  FROM traffic_log t
  WHERE t.kind = 'api'
    AND t.ts >= now() - make_interval(days => p_days)
    AND t.origin_host IS NOT NULL
    AND t.origin_host NOT IN ('energyindex.it', 'www.energyindex.it', 'energyindex.pro', 'www.energyindex.pro')
    AND t.origin_host <> 'energyindex.netlify.app'
    AND t.origin_host NOT LIKE '%--energyindex.netlify.app'
    AND split_part(t.origin_host, ':', 1) NOT IN ('localhost', '127.0.0.1')
    AND t.api_key_prefix IS NULL
    AND COALESCE(t.query, '') NOT ILIKE '%src=widget%'
  GROUP BY t.origin_host
  ORDER BY 2 DESC
  LIMIT 200;
$$;

-- Chiamate per chiave (api_key_prefix = primi 14 caratteri della chiave).
CREATE OR REPLACE FUNCTION admin_api_key_usage(p_days INT)
RETURNS TABLE (api_key_prefix TEXT, requests BIGINT, last_seen TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.api_key_prefix, count(*), max(t.ts)
  FROM traffic_log t
  WHERE t.kind = 'api'
    AND t.ts >= now() - make_interval(days => p_days)
    AND t.api_key_prefix IS NOT NULL
  GROUP BY t.api_key_prefix;
$$;

REVOKE EXECUTE ON FUNCTION admin_widget_domains(INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_keyless_api_domains(INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_api_key_usage(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_widget_domains(INT) TO service_role;
GRANT EXECUTE ON FUNCTION admin_keyless_api_domains(INT) TO service_role;
GRANT EXECUTE ON FUNCTION admin_api_key_usage(INT) TO service_role;
