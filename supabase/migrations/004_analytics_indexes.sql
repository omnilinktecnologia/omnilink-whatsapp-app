-- ─────────────────────────────────────────────────────────────────────────────
-- Analytics performance indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_direction_status
  ON messages(direction, status);

CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_status
  ON campaigns(status);

CREATE INDEX IF NOT EXISTS idx_campaigns_created_at
  ON campaigns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_executions_campaign_id
  ON journey_executions(campaign_id);

CREATE INDEX IF NOT EXISTS idx_journeys_status
  ON journeys(status);

CREATE INDEX IF NOT EXISTS idx_templates_approval_status
  ON templates(approval_status);
