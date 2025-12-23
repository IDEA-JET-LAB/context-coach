-- Story 17-6: Import History & Rollback
-- Creates the historical_imports table for tracking import batches and enabling rollback.
--
-- This migration creates:
-- 1. historical_imports table for tracking import metadata
-- 2. Adds import_id column to prompts table for linking prompts to imports
-- 3. RLS policies for user isolation
-- 4. Indexes for efficient queries

-- ============================================
-- CREATE HISTORICAL_IMPORTS TABLE
-- ============================================
CREATE TABLE historical_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Import source/location
  project_path TEXT,

  -- Counts
  session_count INTEGER DEFAULT 0,
  prompt_count INTEGER DEFAULT 0,
  prompts_imported INTEGER DEFAULT 0,
  prompts_skipped INTEGER DEFAULT 0,
  prompts_failed INTEGER DEFAULT 0,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'complete', 'failed', 'cancelled', 'rolled_back', 'partially_rolled_back', 'rolling_back')
  ),
  error_message TEXT,

  -- Rich metadata (projects breakdown, errors, duration, etc.)
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADD IMPORT_ID COLUMN TO PROMPTS
-- ============================================
-- Links prompts to their import batch for rollback functionality.
-- SET NULL on delete so prompts survive if import record is deleted.
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS
  import_id UUID REFERENCES historical_imports(id) ON DELETE SET NULL;

-- ============================================
-- INDEXES
-- ============================================
-- User lookup with date ordering (for history page)
CREATE INDEX IF NOT EXISTS idx_historical_imports_user_date
  ON historical_imports(user_id, created_at DESC);

-- Status lookup (for finding in-progress imports)
CREATE INDEX IF NOT EXISTS idx_historical_imports_status
  ON historical_imports(status);

-- Prompts by import_id (for rollback queries)
CREATE INDEX IF NOT EXISTS idx_prompts_import_id
  ON prompts(import_id)
  WHERE import_id IS NOT NULL;

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE historical_imports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Users can view their own imports
CREATE POLICY "Users can view own imports"
  ON historical_imports FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own imports
CREATE POLICY "Users can insert own imports"
  ON historical_imports FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own imports (for status changes)
CREATE POLICY "Users can update own imports"
  ON historical_imports FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role has full access (for API routes)
CREATE POLICY "Service role has full access to imports"
  ON historical_imports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE historical_imports IS
  'Tracks historical prompt imports for history display and rollback functionality. Story 17-6.';

COMMENT ON COLUMN historical_imports.metadata IS
  'JSONB containing project breakdown, errors, duration, and other import details. Schema version in metadata.version.';

COMMENT ON COLUMN historical_imports.status IS
  'Import status: pending, processing, complete, failed, cancelled, rolled_back, partially_rolled_back, rolling_back';

COMMENT ON COLUMN prompts.import_id IS
  'References the historical_imports batch this prompt was imported in. NULL for real-time captured prompts.';
