-- Analysis Configuration Tables Migration
-- Story 5.6: Analysis Configuration Management
-- Creates analysis_configs and analysis_dimensions tables for AI Analysis Engine

-- ============================================
-- ANALYSIS CONFIGS TABLE
-- Stores configuration versions for prompt analysis
-- ============================================
CREATE TABLE analysis_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_config_version UNIQUE (version)
);

-- Partial unique index: only one active config allowed
CREATE UNIQUE INDEX idx_one_active_config
  ON analysis_configs (is_active)
  WHERE is_active = true;

-- Index for active config lookup
CREATE INDEX idx_analysis_configs_active ON analysis_configs(is_active);

-- Enable RLS
ALTER TABLE analysis_configs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ANALYSIS CONFIGS RLS POLICIES
-- ============================================

-- All authenticated users can read configs (transparency)
CREATE POLICY "Authenticated users can read configs"
  ON analysis_configs FOR SELECT
  TO authenticated
  USING (true);

-- Super admins can insert configs
CREATE POLICY "Super admins can insert configs"
  ON analysis_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can update configs
CREATE POLICY "Super admins can update configs"
  ON analysis_configs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can delete configs
CREATE POLICY "Super admins can delete configs"
  ON analysis_configs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- ============================================
-- ANALYSIS DIMENSIONS TABLE
-- Scoring dimensions for each analysis config
-- ============================================
CREATE TABLE analysis_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES analysis_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
  prompt_template TEXT NOT NULL,
  scoring_criteria TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT unique_dimension_per_config UNIQUE (config_id, name)
);

-- Index for loading dimensions by config
CREATE INDEX idx_dimensions_config_id ON analysis_dimensions(config_id);

-- Enable RLS
ALTER TABLE analysis_dimensions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ANALYSIS DIMENSIONS RLS POLICIES
-- Same pattern as configs
-- ============================================

-- All authenticated users can read dimensions
CREATE POLICY "Authenticated users can read dimensions"
  ON analysis_dimensions FOR SELECT
  TO authenticated
  USING (true);

-- Super admins can insert dimensions
CREATE POLICY "Super admins can insert dimensions"
  ON analysis_dimensions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can update dimensions
CREATE POLICY "Super admins can update dimensions"
  ON analysis_dimensions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can delete dimensions
CREATE POLICY "Super admins can delete dimensions"
  ON analysis_dimensions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- ============================================
-- TABLE COMMENTS
-- ============================================
COMMENT ON TABLE analysis_configs IS 'Configuration versions for prompt analysis';
COMMENT ON TABLE analysis_dimensions IS 'Scoring dimensions for each analysis config';
COMMENT ON COLUMN analysis_configs.version IS 'Monotonically increasing version number';
COMMENT ON COLUMN analysis_configs.is_active IS 'Only one config can be active at a time (enforced by partial unique index)';
COMMENT ON COLUMN analysis_dimensions.weight IS 'Percentage weight for this dimension (0-100)';
COMMENT ON COLUMN analysis_dimensions.sort_order IS 'Display order for dimensions';
