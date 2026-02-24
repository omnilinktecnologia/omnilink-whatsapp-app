-- ─────────────────────────────────────────────────────────────────────────────
-- OmniLink WhatsApp App — Initial Schema
-- Run this in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Senders (WhatsApp numbers managed by this account) ────────────────────
CREATE TABLE senders (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT        NOT NULL,
  phone_number TEXT        NOT NULL UNIQUE,        -- E.164 e.g. +5511999999999
  twilio_from  TEXT        NOT NULL,               -- "From" value e.g. whatsapp:+5511999999999
  description  TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Contacts ──────────────────────────────────────────────────────────────
CREATE TABLE contacts (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone       TEXT        NOT NULL UNIQUE,          -- E.164
  name        TEXT,
  email       TEXT,
  attributes  JSONB       NOT NULL DEFAULT '{}',    -- arbitrary custom fields
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  opted_out   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Contact Lists ─────────────────────────────────────────────────────────
CREATE TABLE contact_lists (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contact_list_members (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id     UUID        NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  contact_id  UUID        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (list_id, contact_id)
);

-- ── Templates (Twilio Content API registry) ───────────────────────────────
-- Stores both templates created via this app and those imported by ContentSid
CREATE TABLE templates (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT        NOT NULL,
  content_sid         TEXT        UNIQUE,           -- Twilio ContentSid (null until created on Twilio)
  content_type        TEXT        NOT NULL,         -- e.g. twilio/text, twilio/quick-reply, whatsapp/flows
  friendly_name       TEXT        NOT NULL,
  body                TEXT,                         -- text body for preview
  variables           JSONB       NOT NULL DEFAULT '[]',  -- [{ name, description, example }]
  content_definition  JSONB       NOT NULL DEFAULT '{}',  -- full Twilio content definition JSON
  approval_status     TEXT        NOT NULL DEFAULT 'unsubmitted', -- unsubmitted|pending|approved|rejected|paused|disabled
  rejection_reason    TEXT,
  language            TEXT        NOT NULL DEFAULT 'pt_BR',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Journeys (flow graphs) ────────────────────────────────────────────────
CREATE TABLE journeys (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT        NOT NULL,
  description    TEXT,
  trigger_type   TEXT        NOT NULL DEFAULT 'business_initiated', -- business_initiated | user_initiated
  trigger_config JSONB       NOT NULL DEFAULT '{}',  -- keywords, any_message, flow_id, etc.
  graph          JSONB       NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  default_sender_id UUID     REFERENCES senders(id),
  status         TEXT        NOT NULL DEFAULT 'draft', -- draft | published | archived
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Campaigns (business-initiated outbound) ───────────────────────────────
CREATE TABLE campaigns (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT        NOT NULL,
  journey_id      UUID        NOT NULL REFERENCES journeys(id),
  list_id         UUID        NOT NULL REFERENCES contact_lists(id),
  sender_id       UUID        NOT NULL REFERENCES senders(id),
  status          TEXT        NOT NULL DEFAULT 'draft', -- draft|scheduled|running|completed|cancelled
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  total_contacts  INT         NOT NULL DEFAULT 0,
  sent_count      INT         NOT NULL DEFAULT 0,
  delivered_count INT         NOT NULL DEFAULT 0,
  read_count      INT         NOT NULL DEFAULT 0,
  replied_count   INT         NOT NULL DEFAULT 0,
  error_count     INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Journey Executions (runtime state per contact) ────────────────────────
CREATE TABLE journey_executions (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  journey_id      UUID        NOT NULL REFERENCES journeys(id),
  campaign_id     UUID        REFERENCES campaigns(id),
  contact_id      UUID        NOT NULL REFERENCES contacts(id),
  sender_id       UUID        NOT NULL REFERENCES senders(id),
  current_node_id TEXT,
  status          TEXT        NOT NULL DEFAULT 'active', -- active|waiting|completed|failed|timed_out
  variables       JSONB       NOT NULL DEFAULT '{}',     -- execution context: contact data + set variables + http results
  last_reply      JSONB,                                 -- { body, sid, received_at }
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  UNIQUE (campaign_id, contact_id)
);

-- ── Messages (sent and received) ──────────────────────────────────────────
CREATE TABLE messages (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id  UUID        REFERENCES journey_executions(id),
  contact_id    UUID        NOT NULL REFERENCES contacts(id),
  sender_id     UUID        REFERENCES senders(id),
  direction     TEXT        NOT NULL,  -- inbound | outbound
  twilio_sid    TEXT,
  body          TEXT,
  media_urls    JSONB,
  status        TEXT,                  -- sent|delivered|read|failed|received
  template_sid  TEXT,
  error_code    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Events (audit log / journey trail) ────────────────────────────────────
CREATE TABLE events (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id  UUID        REFERENCES journey_executions(id),
  campaign_id   UUID        REFERENCES campaigns(id),
  type          TEXT        NOT NULL,  -- node_entered|node_completed|message_sent|reply_received|http_called|condition_evaluated|delay_started|error|journey_completed
  node_id       TEXT,
  data          JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Jobs (worker queue) ───────────────────────────────────────────────────
CREATE TABLE jobs (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  type         TEXT        NOT NULL,  -- advance_execution|launch_campaign|handle_timeout|process_inbound
  payload      JSONB       NOT NULL DEFAULT '{}',
  status       TEXT        NOT NULL DEFAULT 'pending', -- pending|processing|completed|failed
  priority     INT         NOT NULL DEFAULT 5,
  run_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at    TIMESTAMPTZ,
  locked_by    TEXT,
  attempts     INT         NOT NULL DEFAULT 0,
  max_attempts INT         NOT NULL DEFAULT 3,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_contacts_phone             ON contacts(phone);
CREATE INDEX idx_executions_contact_id      ON journey_executions(contact_id);
CREATE INDEX idx_executions_status          ON journey_executions(status);
CREATE INDEX idx_executions_waiting         ON journey_executions(status, contact_id) WHERE status = 'waiting';
CREATE INDEX idx_messages_contact_id        ON messages(contact_id);
CREATE INDEX idx_messages_twilio_sid        ON messages(twilio_sid);
CREATE INDEX idx_jobs_pending               ON jobs(status, priority DESC, run_at ASC) WHERE status = 'pending';
CREATE INDEX idx_events_execution_id        ON events(execution_id);
CREATE INDEX idx_list_members_list_id       ON contact_list_members(list_id);
CREATE INDEX idx_list_members_contact_id    ON contact_list_members(contact_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Atomic job claim function (FOR UPDATE SKIP LOCKED — prevents double processing)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_jobs(p_worker_id TEXT, p_limit INT DEFAULT 5)
RETURNS SETOF jobs
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE jobs
  SET
    locked_at  = NOW(),
    locked_by  = p_worker_id,
    status     = 'processing',
    attempts   = attempts + 1,
    updated_at = NOW()
  WHERE id IN (
    SELECT id FROM jobs
    WHERE status = 'pending'
      AND run_at <= NOW()
      AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '5 minutes')
    ORDER BY priority DESC, run_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at auto-update trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_senders_updated_at         BEFORE UPDATE ON senders              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contacts_updated_at        BEFORE UPDATE ON contacts             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_contact_lists_updated_at   BEFORE UPDATE ON contact_lists        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_templates_updated_at       BEFORE UPDATE ON templates            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_journeys_updated_at        BEFORE UPDATE ON journeys             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_campaigns_updated_at       BEFORE UPDATE ON campaigns            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_executions_updated_at      BEFORE UPDATE ON journey_executions   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_messages_updated_at        BEFORE UPDATE ON messages             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_jobs_updated_at            BEFORE UPDATE ON jobs                 FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE senders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_lists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys             ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_executions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs                 ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write everything (single-tenant)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['senders','contacts','contact_lists','contact_list_members','templates','journeys','campaigns','journey_executions','messages','events','jobs']
  LOOP
    EXECUTE format('CREATE POLICY "authenticated_all_%s" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END;
$$;
