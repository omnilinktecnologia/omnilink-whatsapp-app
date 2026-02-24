-- ─────────────────────────────────────────────────────────────────────────────
-- Flow Responses — stores WhatsApp Flow form submissions
-- Run this in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE flow_responses (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id    UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  execution_id  UUID        REFERENCES journey_executions(id) ON DELETE SET NULL,
  journey_id    UUID        REFERENCES journeys(id) ON DELETE SET NULL,
  flow_id       TEXT,                                   -- Meta/WhatsApp Flow ID
  flow_token    TEXT,                                   -- Unique token per interaction
  screen_id     TEXT,                                   -- Last screen submitted
  response_data JSONB       NOT NULL DEFAULT '{}',      -- All form field values
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX flow_responses_contact_id_idx    ON flow_responses (contact_id);
CREATE INDEX flow_responses_execution_id_idx  ON flow_responses (execution_id);
CREATE INDEX flow_responses_journey_id_idx    ON flow_responses (journey_id);
CREATE INDEX flow_responses_received_at_idx   ON flow_responses (received_at DESC);

-- RLS: allow service role full access
ALTER TABLE flow_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON flow_responses FOR ALL USING (true);
