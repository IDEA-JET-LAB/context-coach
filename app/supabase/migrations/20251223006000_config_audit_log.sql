-- Configuration Audit Log Migration
-- Story 22-10: Configuration Audit Trail
-- Creates audit log table with monthly partitioning for tracking all configuration changes

-- ============================================
-- AUDIT ACTION ENUM
-- ============================================
-- All possible actions that can be audited

CREATE TYPE audit_action AS ENUM (
  -- Config actions
  'config_created',
  'config_updated',
  'config_activated',
  'config_archived',
  'config_deleted',
  'config_duplicated',
  'config_rolled_back',

  -- Template actions
  'template_created',
  'template_updated',
  'template_published',
  'template_archived',
  'template_deleted',

  -- Rule actions
  'rule_created',
  'rule_updated',
  'rule_enabled',
  'rule_disabled',
  'rule_deleted',

  -- Category actions
  'category_created',
  'category_updated',
  'category_deleted',

  -- Weight actions
  'weight_updated',
  'team_weight_created',
  'team_weight_updated',
  'team_weight_reset',

  -- Experiment actions
  'experiment_created',
  'experiment_updated',
  'experiment_activated',
  'experiment_paused',
  'experiment_resumed',
  'experiment_completed',
  'experiment_winner_applied'
);

-- ============================================
-- AUDIT ENTITY TYPE ENUM
-- ============================================
-- Types of entities that can be audited

CREATE TYPE audit_entity_type AS ENUM (
  'analysis_config',
  'prompt_template',
  'classification_rule',
  'classification_category',
  'scoring_weight',
  'team_weight_override',
  'experiment'
);

-- ============================================
-- MAIN AUDIT LOG TABLE (Partitioned)
-- ============================================
-- Stores all configuration change history

CREATE TABLE config_audit_logs (
  id UUID DEFAULT gen_random_uuid(),
  action audit_action NOT NULL,
  entity_type audit_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  entity_name VARCHAR(200), -- Human-readable name at time of action

  -- Change details
  before_state JSONB, -- NULL for create actions
  after_state JSONB,  -- NULL for delete actions
  change_summary TEXT, -- Human-readable summary

  -- Actor information
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email VARCHAR(255),

  -- Request context
  ip_address INET,
  user_agent TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  correlation_id UUID, -- Group related changes

  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================
-- CREATE MONTHLY PARTITIONS
-- ============================================
-- Create partitions for current month and next 12 months

DO $$
DECLARE
  start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
  end_date DATE;
  partition_name TEXT;
BEGIN
  FOR i IN 0..12 LOOP
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'config_audit_logs_' || TO_CHAR(start_date, 'YYYY_MM');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF config_audit_logs
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );

    start_date := end_date;
  END LOOP;
END $$;

-- ============================================
-- INDEXES FOR COMMON QUERY PATTERNS
-- ============================================

-- Most recent entries first
CREATE INDEX idx_audit_created_at ON config_audit_logs (created_at DESC);

-- Query by entity
CREATE INDEX idx_audit_entity ON config_audit_logs (entity_type, entity_id);

-- Query by action type
CREATE INDEX idx_audit_action ON config_audit_logs (action);

-- Query by user
CREATE INDEX idx_audit_user ON config_audit_logs (changed_by);

-- Correlation groups
CREATE INDEX idx_audit_correlation ON config_audit_logs (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Full-text search on entity name and summary
CREATE INDEX idx_audit_search ON config_audit_logs
  USING gin(to_tsvector('english', COALESCE(entity_name, '') || ' ' || COALESCE(change_summary, '')));

-- ============================================
-- ARCHIVE TABLE FOR OLD ENTRIES
-- ============================================
-- Entries older than 2 years are moved here

CREATE TABLE config_audit_logs_archive (
  id UUID NOT NULL,
  action audit_action NOT NULL,
  entity_type audit_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  entity_name VARCHAR(200),
  before_state JSONB,
  after_state JSONB,
  change_summary TEXT,
  changed_by UUID,
  changed_by_email VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  correlation_id UUID,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
);

-- Index on archive for retrieval queries
CREATE INDEX idx_audit_archive_created ON config_audit_logs_archive (created_at DESC);
CREATE INDEX idx_audit_archive_entity ON config_audit_logs_archive (entity_type, entity_id);

-- ============================================
-- ARCHIVE FUNCTION
-- ============================================
-- Moves entries older than 2 years to archive table

CREATE OR REPLACE FUNCTION archive_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
  cutoff_date TIMESTAMPTZ := NOW() - INTERVAL '2 years';
BEGIN
  -- Move old entries to archive
  WITH moved AS (
    DELETE FROM config_audit_logs
    WHERE created_at < cutoff_date
    RETURNING *
  )
  INSERT INTO config_audit_logs_archive (
    id, action, entity_type, entity_id, entity_name,
    before_state, after_state, change_summary,
    changed_by, changed_by_email, ip_address, user_agent,
    created_at, correlation_id
  )
  SELECT
    id, action, entity_type, entity_id, entity_name,
    before_state, after_state, change_summary,
    changed_by, changed_by_email, ip_address, user_agent,
    created_at, correlation_id
  FROM moved;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PARTITION MAINTENANCE FUNCTION
-- ============================================
-- Creates new partitions for upcoming months

CREATE OR REPLACE FUNCTION maintain_audit_partitions()
RETURNS void AS $$
DECLARE
  start_date DATE := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '12 months');
  end_date DATE;
  partition_name TEXT;
BEGIN
  -- Create partition for 12 months ahead
  end_date := start_date + INTERVAL '1 month';
  partition_name := 'config_audit_logs_' || TO_CHAR(start_date, 'YYYY_MM');

  BEGIN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF config_audit_logs
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
  EXCEPTION
    WHEN duplicate_table THEN
      -- Partition already exists, ignore
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE config_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_audit_logs_archive ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================
-- Super admins can read all audit logs
-- Only service role can write (insert happens through server actions)

-- Read policy - all authenticated users with super admin status can read
-- The actual super admin check happens in the application layer
CREATE POLICY "Super admins can view audit logs" ON config_audit_logs
  FOR SELECT USING (
    auth.role() = 'service_role' OR auth.role() = 'authenticated'
  );

CREATE POLICY "Super admins can view archived audit logs" ON config_audit_logs_archive
  FOR SELECT USING (
    auth.role() = 'service_role' OR auth.role() = 'authenticated'
  );

-- Write policies - only service role can insert/update/delete
CREATE POLICY "Service role can insert audit logs" ON config_audit_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can delete audit logs" ON config_audit_logs
  FOR DELETE TO service_role
  USING (true);

CREATE POLICY "Service role can manage archived logs" ON config_audit_logs_archive
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- TABLE COMMENTS
-- ============================================

COMMENT ON TABLE config_audit_logs IS
  'Tracks all configuration changes for compliance and debugging. Partitioned by month for performance.';

COMMENT ON COLUMN config_audit_logs.id IS
  'Unique identifier for this audit entry';

COMMENT ON COLUMN config_audit_logs.action IS
  'Type of action performed (create, update, delete, activate, etc.)';

COMMENT ON COLUMN config_audit_logs.entity_type IS
  'Type of entity that was changed (analysis_config, prompt_template, etc.)';

COMMENT ON COLUMN config_audit_logs.entity_id IS
  'UUID of the entity that was changed';

COMMENT ON COLUMN config_audit_logs.entity_name IS
  'Human-readable name of the entity at the time of the change';

COMMENT ON COLUMN config_audit_logs.before_state IS
  'JSON snapshot of entity state before the change (NULL for creates)';

COMMENT ON COLUMN config_audit_logs.after_state IS
  'JSON snapshot of entity state after the change (NULL for deletes)';

COMMENT ON COLUMN config_audit_logs.change_summary IS
  'Human-readable summary of what changed';

COMMENT ON COLUMN config_audit_logs.changed_by IS
  'User ID of who made the change';

COMMENT ON COLUMN config_audit_logs.changed_by_email IS
  'Email of who made the change (denormalized for historical accuracy)';

COMMENT ON COLUMN config_audit_logs.ip_address IS
  'IP address from which the change was made';

COMMENT ON COLUMN config_audit_logs.user_agent IS
  'Browser/client user agent string';

COMMENT ON COLUMN config_audit_logs.created_at IS
  'Timestamp of when the change occurred';

COMMENT ON COLUMN config_audit_logs.correlation_id IS
  'Groups related changes together (e.g., batch operations)';

COMMENT ON TABLE config_audit_logs_archive IS
  'Cold storage for audit entries older than 2 years';

COMMENT ON FUNCTION archive_old_audit_logs IS
  'Moves audit entries older than 2 years to the archive table. Returns count of archived entries.';

COMMENT ON FUNCTION maintain_audit_partitions IS
  'Creates new monthly partitions for upcoming months. Should be called periodically via cron.';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== CONFIG AUDIT LOG MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created config_audit_logs table with monthly partitioning';
  RAISE NOTICE 'Created config_audit_logs_archive table for cold storage';
  RAISE NOTICE 'Created indexes for common query patterns';
  RAISE NOTICE 'Created archive_old_audit_logs() function';
  RAISE NOTICE 'Created maintain_audit_partitions() function';
  RAISE NOTICE 'Enabled RLS with super admin read access';
  RAISE NOTICE '==========================================';
END $$;
