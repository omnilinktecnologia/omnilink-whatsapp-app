-- ─────────────────────────────────────────────────────────────────────────────
-- Add campaign_id to flow_responses for easy campaign-level aggregation
-- Run this in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE flow_responses
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS flow_responses_campaign_id_idx ON flow_responses (campaign_id);
