-- Esito dell'ultimo controllo settimanale della fonte sui siti che chiamano le
-- API (scripts/check-consumer-sources.ts). Solo service role: RLS attiva e
-- nessuna policy per anon/authenticated.
CREATE TABLE IF NOT EXISTS api_consumer_sources (
  site        TEXT PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('link', 'testo', 'assente', 'errore')),
  checked_at  TIMESTAMPTZ NOT NULL
);
ALTER TABLE api_consumer_sources ENABLE ROW LEVEL SECURITY;
