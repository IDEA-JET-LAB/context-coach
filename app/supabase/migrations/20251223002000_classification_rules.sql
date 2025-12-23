-- Migration: 20251223002000_classification_rules.sql
-- Story 22-2: Classification Rule Editor
-- Creates tables for classification categories and rules with RLS and audit triggers

-- ============================================================================
-- Classification Categories Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS classification_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for UI
  sort_order INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE classification_categories IS 'Categories for classifying prompts (e.g., feature_request, bug_fix)';
COMMENT ON COLUMN classification_categories.color IS 'Hex color code for UI display';
COMMENT ON COLUMN classification_categories.is_archived IS 'Archived categories cannot be assigned to new rules';

-- ============================================================================
-- Classification Rules Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category_id UUID REFERENCES classification_categories(id) ON DELETE RESTRICT,
  pattern TEXT NOT NULL,
  pattern_flags VARCHAR(10) DEFAULT 'i', -- Regex flags (i, g, m, etc.)
  priority INTEGER DEFAULT 50 CHECK (priority >= 1 AND priority <= 100),
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  match_count INTEGER DEFAULT 0, -- Updated by analytics pipeline
  last_matched_at TIMESTAMPTZ,
  redos_risk VARCHAR(20) DEFAULT 'safe' CHECK (redos_risk IN ('safe', 'warning', 'dangerous')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE classification_rules IS 'Regex-based rules for automatic prompt classification';
COMMENT ON COLUMN classification_rules.pattern IS 'JavaScript-compatible regex pattern';
COMMENT ON COLUMN classification_rules.pattern_flags IS 'Regex flags like i (case-insensitive), g (global), m (multiline)';
COMMENT ON COLUMN classification_rules.priority IS 'Higher priority rules match first (1-100)';
COMMENT ON COLUMN classification_rules.redos_risk IS 'ReDoS vulnerability assessment: safe, warning, or dangerous';
COMMENT ON COLUMN classification_rules.match_count IS 'Number of prompts matched by this rule';

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_classification_rules_category
  ON classification_rules(category_id);

CREATE INDEX IF NOT EXISTS idx_classification_rules_enabled
  ON classification_rules(enabled) WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_classification_rules_priority
  ON classification_rules(priority DESC);

CREATE INDEX IF NOT EXISTS idx_classification_categories_archived
  ON classification_categories(is_archived) WHERE is_archived = FALSE;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE classification_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;

-- Super admin read access for categories
CREATE POLICY "Super admins can read categories"
  ON classification_categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = TRUE
    )
  );

-- Super admin write access for categories
CREATE POLICY "Super admins can manage categories"
  ON classification_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = TRUE
    )
  );

-- Super admin read access for rules
CREATE POLICY "Super admins can read rules"
  ON classification_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = TRUE
    )
  );

-- Super admin write access for rules
CREATE POLICY "Super admins can manage rules"
  ON classification_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_super_admin = TRUE
    )
  );

-- Service role bypass for internal use (e.g., analytics pipeline)
CREATE POLICY "Service role can access categories"
  ON classification_categories
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "Service role can access rules"
  ON classification_rules
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to categories
DROP TRIGGER IF EXISTS update_classification_categories_updated_at ON classification_categories;
CREATE TRIGGER update_classification_categories_updated_at
  BEFORE UPDATE ON classification_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to rules
DROP TRIGGER IF EXISTS update_classification_rules_updated_at ON classification_rules;
CREATE TRIGGER update_classification_rules_updated_at
  BEFORE UPDATE ON classification_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Audit Trail Integration
-- ============================================================================

-- Audit trigger for categories
CREATE OR REPLACE FUNCTION audit_classification_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_audit_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    CASE TG_OP
      WHEN 'INSERT' THEN 'create'
      WHEN 'UPDATE' THEN 'update'
      WHEN 'DELETE' THEN 'delete'
    END,
    'classification_category',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_classification_categories_trigger ON classification_categories;
CREATE TRIGGER audit_classification_categories_trigger
  AFTER INSERT OR UPDATE OR DELETE ON classification_categories
  FOR EACH ROW
  EXECUTE FUNCTION audit_classification_categories();

-- Audit trigger for rules
CREATE OR REPLACE FUNCTION audit_classification_rules()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_audit_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    CASE TG_OP
      WHEN 'INSERT' THEN 'create'
      WHEN 'UPDATE' THEN 'update'
      WHEN 'DELETE' THEN 'delete'
    END,
    'classification_rule',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_classification_rules_trigger ON classification_rules;
CREATE TRIGGER audit_classification_rules_trigger
  AFTER INSERT OR UPDATE OR DELETE ON classification_rules
  FOR EACH ROW
  EXECUTE FUNCTION audit_classification_rules();

-- ============================================================================
-- Seed Default Categories (based on Epic 21 research)
-- ============================================================================

INSERT INTO classification_categories (name, description, color, sort_order) VALUES
  ('feature_request', 'New feature implementation requests', '#22c55e', 1),
  ('bug_fix', 'Bug fixes and error resolution', '#ef4444', 2),
  ('refactoring', 'Code refactoring and cleanup', '#f59e0b', 3),
  ('documentation', 'Documentation and comments', '#3b82f6', 4),
  ('testing', 'Test creation and modification', '#8b5cf6', 5),
  ('debugging', 'Debugging and investigation', '#ec4899', 6),
  ('configuration', 'Config and setup tasks', '#6366f1', 7),
  ('learning', 'Questions and exploration', '#14b8a6', 8)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Seed Sample Classification Rules
-- ============================================================================

-- Bug Fix Keywords Rule
INSERT INTO classification_rules (name, category_id, pattern, priority, description, created_by)
SELECT
  'Bug Fix Keywords',
  c.id,
  '\b(fix|bug|error|issue|problem|broken|crash|fail)\b',
  80,
  'Matches common bug-related terminology',
  NULL
FROM classification_categories c
WHERE c.name = 'bug_fix'
ON CONFLICT DO NOTHING;

-- Feature Creation Rule
INSERT INTO classification_rules (name, category_id, pattern, priority, description, created_by)
SELECT
  'Feature Creation',
  c.id,
  '\b(add|create|implement|build|new feature|introduce)\b',
  70,
  'Matches feature creation language',
  NULL
FROM classification_categories c
WHERE c.name = 'feature_request'
ON CONFLICT DO NOTHING;

-- Test Keywords Rule
INSERT INTO classification_rules (name, category_id, pattern, priority, description, created_by)
SELECT
  'Test Keywords',
  c.id,
  '\b(test|spec|assert|expect|mock|jest|playwright|vitest)\b',
  75,
  'Matches testing-related terminology',
  NULL
FROM classification_categories c
WHERE c.name = 'testing'
ON CONFLICT DO NOTHING;

-- Refactoring Keywords Rule
INSERT INTO classification_rules (name, category_id, pattern, priority, description, created_by)
SELECT
  'Refactoring Keywords',
  c.id,
  '\b(refactor|clean up|reorganize|restructure|extract|simplify)\b',
  65,
  'Matches refactoring-related terminology',
  NULL
FROM classification_categories c
WHERE c.name = 'refactoring'
ON CONFLICT DO NOTHING;

-- Documentation Keywords Rule
INSERT INTO classification_rules (name, category_id, pattern, priority, description, created_by)
SELECT
  'Documentation Keywords',
  c.id,
  '\b(document|readme|comment|explain|describe|jsdoc|docstring)\b',
  60,
  'Matches documentation-related terminology',
  NULL
FROM classification_categories c
WHERE c.name = 'documentation'
ON CONFLICT DO NOTHING;

-- Debugging Keywords Rule
INSERT INTO classification_rules (name, category_id, pattern, priority, description, created_by)
SELECT
  'Debugging Keywords',
  c.id,
  '\b(debug|investigate|trace|log|console|inspect|why|diagnose)\b',
  55,
  'Matches debugging-related terminology',
  NULL
FROM classification_categories c
WHERE c.name = 'debugging'
ON CONFLICT DO NOTHING;
