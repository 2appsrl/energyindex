-- ===== api_keys =====
-- Chiavi API self-service legate a un dominio. Si salva solo sha256(chiave).
-- Accesso solo con la service role: nessuna policy per anon/authenticated.
CREATE TABLE IF NOT EXISTS api_keys (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix             TEXT UNIQUE,                 -- "eidx_live_ab12", null finche' pending
  key_hash           TEXT UNIQUE,                 -- sha256 hex, null finche' pending
  email              TEXT NOT NULL,
  nome               TEXT NOT NULL,
  azienda            TEXT,
  progetto           TEXT,
  plan               TEXT NOT NULL DEFAULT 'developer'
                       CHECK (plan IN ('developer', 'api', 'pro', 'trading', 'enterprise')),
  domain             TEXT NOT NULL,
  attribution_url    TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'active', 'downgraded', 'revoked')),
  verify_token_hash  TEXT UNIQUE,
  verify_expires_at  TIMESTAMPTZ,
  link_checked_at    TIMESTAMPTZ,
  link_ok            BOOLEAN,
  link_failures      INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at       TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys (status);
CREATE INDEX IF NOT EXISTS idx_api_keys_email ON api_keys (lower(email));
-- Una sola chiave viva per email e dominio: chiude la corsa tra due
-- attivazioni quasi simultanee (il controllo dei duplicati e' solo applicativo).
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_live_email_domain
  ON api_keys (lower(email), domain) WHERE status IN ('active', 'downgraded');
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ===== api_throttle =====
-- Soggetti oltre quota: "key:<prefix>" o "ip:<ip_hash>". La scrive
-- refresh_api_throttle(), la legge il middleware (cache 60 s).
CREATE TABLE IF NOT EXISTS api_throttle (
  subject   TEXT PRIMARY KEY,
  until     TIMESTAMPTZ NOT NULL,
  requests  INT NOT NULL,
  window_limit INT NOT NULL
);
ALTER TABLE api_throttle ENABLE ROW LEVEL SECURITY;

-- Limite al minuto per piano, uguale a TIERS in lib/api/catalog.ts.
CREATE OR REPLACE FUNCTION api_plan_rate_per_minute(p TEXT) RETURNS INT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p
    WHEN 'developer' THEN 120
    WHEN 'api' THEN 600
    WHEN 'pro' THEN 1200
    WHEN 'trading' THEN 3000
    WHEN 'enterprise' THEN 100000
    ELSE 60 END
$$;

-- Quote "morbide": conta le chiamate degli ultimi 5 minuti in traffic_log e
-- blocca per 15 minuti chi supera 5 x limite/minuto. Le chiamate con chiave
-- non attiva (declassata, sconosciuta) contano come anonime, per IP.
CREATE OR REPLACE FUNCTION refresh_api_throttle() RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  DELETE FROM api_throttle WHERE until < now();

  WITH recent AS (
    SELECT t.api_key_prefix, t.ip_hash, k.plan
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

-- Nessun segreto nel comando: puo' stare nella migrazione (a differenza
-- dei cron ETL che chiamano le Edge Function con la service key).
SELECT cron.schedule('api-throttle-refresh', '*/5 * * * *', $$SELECT public.refresh_api_throttle()$$);
