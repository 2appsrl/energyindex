-- Posta in arrivo su pro@energyindex.pro, letta via IMAP da
-- scripts/sync-mail-pro.ts, classificata e con una bozza di risposta.
-- Contiene dati personali di chi scrive: solo service_role (RLS attiva senza
-- policy), come leads e traffic_log.
CREATE TABLE IF NOT EXISTS inbound_emails (
  id                 BIGSERIAL PRIMARY KEY,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Message-ID RFC 5322: evita i doppioni tra una sincronizzazione e l'altra.
  message_id         TEXT NOT NULL UNIQUE,
  received_at        TIMESTAMPTZ NOT NULL,
  from_name          TEXT,
  from_email         TEXT,
  -- A chi rispondere: Reply-To se c'e' (i messaggi del form contatti partono
  -- da Resend e hanno qui l'indirizzo del visitatore), altrimenti il mittente.
  reply_to           TEXT,
  subject            TEXT,
  body_text          TEXT,
  attachment_names   TEXT[] NOT NULL DEFAULT '{}',
  -- Analisi: tutto null finche' il messaggio non e' stato analizzato.
  category           TEXT CHECK (category IN (
                       'api_dati', 'commerciale_pro', 'partnership', 'supporto',
                       'proposta_fornitore', 'automatica', 'spam', 'altro')),
  priority           TEXT CHECK (priority IN ('alta', 'normale', 'bassa')),
  summary            TEXT,
  reply_subject      TEXT,
  reply_draft        TEXT,
  -- Cosa controllare prima di inviare la bozza (licenze, prezzi non a catalogo...).
  review_note        TEXT,
  analyzed_at        TIMESTAMPTZ,
  analysis_model     TEXT,
  analysis_attempts  INT NOT NULL DEFAULT 0,
  analysis_error     TEXT,
  status             TEXT NOT NULL DEFAULT 'nuova'
                     CHECK (status IN ('nuova', 'risposta', 'archiviata'))
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_received ON inbound_emails (received_at DESC);
-- Coda dell'analisi: messaggi ancora senza esito.
CREATE INDEX IF NOT EXISTS idx_inbound_emails_pending ON inbound_emails (received_at) WHERE analyzed_at IS NULL;

ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;
