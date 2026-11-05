-- PUN e PSV non sono in vendita: sui percorsi con dati GME nessun piano a
-- pagamento ha un limite piu' alto del Developer gratuito. Oltre quel limite
-- la chiave e' bloccata solo su quei percorsi (subject "gmekey:<prefix>");
-- la quota del piano continua a valere per gli altri servizi.
-- Il percorso e' lo stesso di GME_PATH_PATTERN in lib/api-keys/gate.ts.
CREATE OR REPLACE FUNCTION refresh_api_throttle() RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  DELETE FROM api_throttle WHERE until < now();

  WITH recent AS (
    SELECT t.api_key_prefix, t.ip_hash, t.path, k.plan
    FROM traffic_log t
    LEFT JOIN api_keys k ON k.prefix = t.api_key_prefix AND k.status = 'active'
    WHERE t.kind = 'api' AND t.ts > now() - interval '5 minutes'
  ),
  over AS (
    SELECT 'key:' || api_key_prefix AS subject, count(*)::int AS requests,
           5 * api_plan_rate_per_minute(plan) AS window_limit
    FROM recent WHERE plan IS NOT NULL
    GROUP BY api_key_prefix, plan
    HAVING count(*) > 5 * api_plan_rate_per_minute(plan)
    UNION ALL
    SELECT 'gmekey:' || api_key_prefix, count(*)::int, 5 * api_plan_rate_per_minute('developer')
    FROM recent WHERE plan IS NOT NULL AND path ~ '^/api/v1/(pun|psv|today|prices/(pun|psv))(/|$)'
    GROUP BY api_key_prefix
    HAVING count(*) > 5 * api_plan_rate_per_minute('developer')
    UNION ALL
    SELECT 'ip:' || ip_hash, count(*)::int, 5 * api_plan_rate_per_minute(NULL)
    FROM recent WHERE plan IS NULL AND ip_hash IS NOT NULL
    GROUP BY ip_hash
    HAVING count(*) > 5 * api_plan_rate_per_minute(NULL)
  )
  INSERT INTO api_throttle (subject, until, requests, window_limit)
  SELECT subject, now() + interval '15 minutes', requests, window_limit FROM over
  ON CONFLICT (subject) DO UPDATE
    SET until = EXCLUDED.until, requests = EXCLUDED.requests, window_limit = EXCLUDED.window_limit;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION refresh_api_throttle() FROM PUBLIC, anon, authenticated;
