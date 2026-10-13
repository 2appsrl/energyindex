-- Dashboard admin: log del traffico API e bot, lead dai form, funzioni di
-- aggregazione. Tutto leggibile/scrivibile SOLO da service_role: le tabelle
-- hanno RLS attiva senza policy, le funzioni sono revocate a anon/authenticated.

-- ===== traffic_log =====
-- Una riga per ogni chiamata a /api/v1/* e per ogni visita di un bot
-- (crawler AI, motori di ricerca, social, SEO) alle pagine del sito.
-- Scritta dal middleware (edge) via PostgREST con la service role key.
CREATE TABLE IF NOT EXISTS traffic_log (
  id              BIGSERIAL PRIMARY KEY,
  ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind            TEXT NOT NULL CHECK (kind IN ('api', 'bot')),
  path            TEXT NOT NULL,
  query           TEXT,
  method          TEXT NOT NULL DEFAULT 'GET',
  origin_host     TEXT,
  referer_host    TEXT,
  user_agent      TEXT,
  -- Nome classificato del client: 'GPTBot', 'Googlebot', 'Google Sheets', 'curl', 'Browser'...
  agent           TEXT,
  -- Famiglia: ai | search | social | seo | tool | browser | bot | other
  agent_kind      TEXT,
  country         TEXT,
  -- SHA-256 troncato di IP + giorno + sale: conta i visitatori unici del
  -- giorno senza conservare l'IP (il sale cambia ogni giorno).
  ip_hash         TEXT,
  api_key_prefix  TEXT,
  -- Chi e' il consumatore, nell'ordine: chiave API, sito chiamante, referer,
  -- tipo di client + impronta giornaliera.
  consumer        TEXT GENERATED ALWAYS AS (
    COALESCE(api_key_prefix, origin_host, referer_host, COALESCE(agent, 'sconosciuto') || ' #' || LEFT(COALESCE(ip_hash, '------'), 6))
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_traffic_log_kind_ts ON traffic_log (kind, ts DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_log_ts ON traffic_log (ts DESC);

ALTER TABLE traffic_log ENABLE ROW LEVEL SECURITY;

-- ===== leads =====
-- Richieste di API key (/it/api) e messaggi dal form contatti (/it/pro).
-- Prima arrivavano solo via email: qui restano con uno stato di lavorazione.
CREATE TABLE IF NOT EXISTS leads (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  source      TEXT NOT NULL CHECK (source IN ('api_key', 'contact')),
  nome        TEXT,
  email       TEXT NOT NULL,
  azienda     TEXT,
  piano       TEXT,
  oggetto     TEXT,
  messaggio   TEXT,
  status      TEXT NOT NULL DEFAULT 'nuovo'
              CHECK (status IN ('nuovo', 'contattato', 'attivato', 'scartato')),
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- ===== Aggregazioni per la dashboard =====

-- Richieste e visitatori unici per giorno (fuso Europe/Rome).
CREATE OR REPLACE FUNCTION admin_traffic_daily(p_kind TEXT, p_days INT, p_agent_kind TEXT DEFAULT NULL)
RETURNS TABLE (day DATE, requests BIGINT, uniques BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (ts AT TIME ZONE 'Europe/Rome')::date AS day,
         count(*) AS requests,
         count(DISTINCT ip_hash) AS uniques
  FROM traffic_log
  WHERE kind = p_kind
    AND ts >= now() - make_interval(days => p_days)
    AND (p_agent_kind IS NULL OR agent_kind = p_agent_kind)
  GROUP BY 1
  ORDER BY 1;
$$;

-- Classifica per una dimensione (whitelist, niente SQL arbitrario).
CREATE OR REPLACE FUNCTION admin_traffic_top(
  p_kind TEXT,
  p_dimension TEXT,
  p_days INT,
  p_limit INT DEFAULT 10,
  p_agent_kind TEXT DEFAULT NULL
)
RETURNS TABLE (label TEXT, requests BIGINT, uniques BIGINT, first_seen TIMESTAMPTZ, last_seen TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_dimension NOT IN ('path', 'origin_host', 'referer_host', 'agent', 'agent_kind', 'country', 'api_key_prefix', 'consumer') THEN
    RAISE EXCEPTION 'dimensione non valida: %', p_dimension;
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT COALESCE(%1$I, ''(nessuno)'')::text, count(*), count(DISTINCT ip_hash), min(ts), max(ts)
       FROM traffic_log
      WHERE kind = $1
        AND ts >= now() - make_interval(days => $2)
        AND ($4::text IS NULL OR agent_kind = $4)
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT $3',
    p_dimension
  ) USING p_kind, p_days, p_limit, p_agent_kind;
END;
$$;

-- Consumatori API comparsi per la prima volta negli ultimi p_days giorni.
CREATE OR REPLACE FUNCTION admin_api_new_consumers(p_days INT DEFAULT 7, p_limit INT DEFAULT 20)
RETURNS TABLE (consumer TEXT, agent TEXT, first_seen TIMESTAMPTZ, requests BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.consumer, max(t.agent), min(t.ts), count(*)
  FROM traffic_log t
  WHERE t.kind = 'api'
  GROUP BY t.consumer
  HAVING min(t.ts) >= now() - make_interval(days => p_days)
  ORDER BY min(t.ts) DESC
  LIMIT p_limit;
$$;

-- Ultima esecuzione di ogni fonte ETL + errori degli ultimi 7 giorni.
CREATE OR REPLACE FUNCTION admin_etl_status()
RETURNS TABLE (
  source TEXT, started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ, status TEXT,
  rows_ingested INT, error_message TEXT, errors_7d BIGINT, runs_7d BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH last AS (
    SELECT DISTINCT ON (r.source) r.source, r.started_at, r.finished_at, r.status, r.rows_ingested, r.error_message
    FROM etl_runs r
    ORDER BY r.source, r.started_at DESC
  ), week AS (
    SELECT r.source, count(*) FILTER (WHERE r.status = 'error') AS errors_7d, count(*) AS runs_7d
    FROM etl_runs r
    WHERE r.started_at >= now() - interval '7 days'
    GROUP BY r.source
  )
  SELECT l.source, l.started_at, l.finished_at, l.status, l.rows_ingested, LEFT(l.error_message, 300),
         COALESCE(w.errors_7d, 0), COALESCE(w.runs_7d, 0)
  FROM last l LEFT JOIN week w USING (source)
  ORDER BY l.started_at DESC;
$$;

-- Job pg_cron e loro ultima esecuzione.
CREATE OR REPLACE FUNCTION admin_cron_status()
RETURNS TABLE (jobname TEXT, schedule TEXT, active BOOLEAN, last_start TIMESTAMPTZ, last_status TEXT, last_message TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, cron AS $$
  SELECT j.jobname::text, j.schedule::text, j.active, r.start_time, r.status::text, LEFT(r.return_message, 300)
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT d.start_time, d.status, d.return_message
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
    ORDER BY d.start_time DESC
    LIMIT 1
  ) r ON true
  ORDER BY j.jobname;
$$;

REVOKE EXECUTE ON FUNCTION admin_traffic_daily(TEXT, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_traffic_top(TEXT, TEXT, INT, INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_api_new_consumers(INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_etl_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_cron_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_traffic_daily(TEXT, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION admin_traffic_top(TEXT, TEXT, INT, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION admin_api_new_consumers(INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION admin_etl_status() TO service_role;
GRANT EXECUTE ON FUNCTION admin_cron_status() TO service_role;

-- ===== Retention =====
-- Il log serve per tendenze, non per archivio: 180 giorni bastano e tengono
-- la tabella piccola anche con molto traffico.
SELECT cron.schedule(
  'traffic-log-retention',
  '15 3 * * *',
  $$DELETE FROM traffic_log WHERE ts < now() - interval '180 days'$$
);
