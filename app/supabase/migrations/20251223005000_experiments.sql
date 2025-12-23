-- A/B Experiments Migration
-- Story 22.6: A/B Experiment Creation
-- Creates experiments, experiment_variants, and experiment_assignments tables

-- ============================================
-- EXPERIMENT STATUS ENUM
-- ============================================
DO $$ BEGIN
  CREATE TYPE experiment_status AS ENUM (
    'draft',      -- Not yet started
    'active',     -- Ready to run (validated)
    'running',    -- Currently splitting traffic
    'paused',     -- Temporarily stopped
    'analyzing',  -- Collecting final stats
    'completed'   -- Finished with results
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- EXPERIMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  hypothesis TEXT NOT NULL,
  status experiment_status DEFAULT 'draft',

  -- Traffic configuration
  traffic_percentage INTEGER DEFAULT 50
    CHECK (traffic_percentage >= 10 AND traffic_percentage <= 90),

  -- Success criteria
  min_sample_size INTEGER DEFAULT 100 CHECK (min_sample_size >= 50),
  min_duration_hours INTEGER DEFAULT 24 CHECK (min_duration_hours >= 1),
  significance_threshold DECIMAL(4,3) DEFAULT 0.05
    CHECK (significance_threshold >= 0.001 AND significance_threshold <= 0.1),
  success_metric VARCHAR(50) DEFAULT 'overall_score',
  auto_promote_winner BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Results (populated when analyzing/completed)
  winner_variant VARCHAR(20) CHECK (winner_variant IN ('control', 'variant', 'inconclusive', NULL)),
  p_value DECIMAL(6,5),
  effect_size DECIMAL(6,4),
  confidence_interval JSONB
);

-- ============================================
-- EXPERIMENT VARIANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS experiment_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_name VARCHAR(20) NOT NULL CHECK (variant_name IN ('control', 'variant')),
  config_id UUID NOT NULL REFERENCES analysis_configs(id),
  config_snapshot JSONB, -- Snapshot of config at activation time
  sample_count INTEGER DEFAULT 0,
  mean_score DECIMAL(5,2),
  std_deviation DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_experiment_variant UNIQUE (experiment_id, variant_name)
);

-- ============================================
-- EXPERIMENT ASSIGNMENTS TABLE
-- For sticky assignment of users to variants
-- ============================================
CREATE TABLE IF NOT EXISTS experiment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  variant_name VARCHAR(20) NOT NULL CHECK (variant_name IN ('control', 'variant')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_experiment UNIQUE (experiment_id, user_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_created_at ON experiments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_variants_experiment ON experiment_variants(experiment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_experiment ON experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON experiment_assignments(user_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_experiments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_experiments_updated_at ON experiments;
CREATE TRIGGER set_experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_experiments_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- EXPERIMENTS RLS POLICIES
-- ============================================

-- Super admins can read all experiments
CREATE POLICY "Super admins can read experiments"
  ON experiments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can insert experiments
CREATE POLICY "Super admins can insert experiments"
  ON experiments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can update experiments
CREATE POLICY "Super admins can update experiments"
  ON experiments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can delete experiments
CREATE POLICY "Super admins can delete experiments"
  ON experiments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- ============================================
-- EXPERIMENT VARIANTS RLS POLICIES
-- ============================================

-- Super admins can read all variants
CREATE POLICY "Super admins can read experiment variants"
  ON experiment_variants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can insert variants
CREATE POLICY "Super admins can insert experiment variants"
  ON experiment_variants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can update variants
CREATE POLICY "Super admins can update experiment variants"
  ON experiment_variants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can delete variants
CREATE POLICY "Super admins can delete experiment variants"
  ON experiment_variants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- ============================================
-- EXPERIMENT ASSIGNMENTS RLS POLICIES
-- ============================================

-- Super admins can read all assignments
CREATE POLICY "Super admins can read experiment assignments"
  ON experiment_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can insert assignments
CREATE POLICY "Super admins can insert experiment assignments"
  ON experiment_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can update assignments
CREATE POLICY "Super admins can update experiment assignments"
  ON experiment_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Super admins can delete assignments
CREATE POLICY "Super admins can delete experiment assignments"
  ON experiment_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- ============================================
-- TABLE COMMENTS
-- ============================================
COMMENT ON TABLE experiments IS 'A/B experiments for testing analysis configuration changes';
COMMENT ON TABLE experiment_variants IS 'Variants (control/treatment) for each experiment';
COMMENT ON TABLE experiment_assignments IS 'Sticky user assignments to experiment variants';

COMMENT ON COLUMN experiments.traffic_percentage IS 'Percentage of traffic going to variant (10-90%)';
COMMENT ON COLUMN experiments.min_sample_size IS 'Minimum samples per variant before results';
COMMENT ON COLUMN experiments.significance_threshold IS 'P-value threshold for significance (default 0.05)';
COMMENT ON COLUMN experiments.winner_variant IS 'Declared winner: control, variant, or inconclusive';
COMMENT ON COLUMN experiment_variants.config_snapshot IS 'JSON snapshot of config at experiment activation';
