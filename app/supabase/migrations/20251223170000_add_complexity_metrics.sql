-- Complexity Metrics Migration
-- Story 21-4: Prompt Complexity Metrics
--
-- Adds columns for tracking prompt complexity:
-- - sentence_count: Number of sentences detected
-- - has_code: Whether prompt contains code blocks/patterns
-- - has_file_refs: Whether prompt references files/paths
-- - code_block_count: Count of fenced code blocks
-- - file_ref_count: Count of file references
-- - complexity_level: 'simple' | 'moderate' | 'complex'
-- - complexity_score: 0-100 numeric score

-- ============================================
-- ADD COMPLEXITY COLUMNS TO PROMPTS TABLE
-- ============================================

-- Sentence count (nullable for backwards compatibility)
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS sentence_count INTEGER;

-- Code detection flags
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS has_code BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS code_block_count INTEGER DEFAULT 0;

-- File reference detection
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS has_file_refs BOOLEAN DEFAULT false;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS file_ref_count INTEGER DEFAULT 0;

-- Complexity classification
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS complexity_level VARCHAR(20);
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS complexity_score INTEGER;

-- ============================================
-- CONSTRAINTS
-- ============================================

-- Ensure complexity_level is one of the valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_complexity_level'
  ) THEN
    ALTER TABLE prompts ADD CONSTRAINT valid_complexity_level CHECK (
      complexity_level IS NULL OR complexity_level IN ('simple', 'moderate', 'complex')
    );
  END IF;
END $$;

-- Ensure complexity_score is 0-100
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_complexity_score'
  ) THEN
    ALTER TABLE prompts ADD CONSTRAINT valid_complexity_score CHECK (
      complexity_score IS NULL OR (complexity_score >= 0 AND complexity_score <= 100)
    );
  END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================

-- Index for filtering by complexity level
CREATE INDEX IF NOT EXISTS idx_prompts_complexity_level
  ON prompts(complexity_level)
  WHERE complexity_level IS NOT NULL;

-- Index for filtering by code presence
CREATE INDEX IF NOT EXISTS idx_prompts_has_code
  ON prompts(has_code)
  WHERE has_code = true;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN prompts.sentence_count IS 'Number of sentences detected in the prompt';
COMMENT ON COLUMN prompts.has_code IS 'Whether the prompt contains code blocks or code patterns';
COMMENT ON COLUMN prompts.has_file_refs IS 'Whether the prompt references file paths or extensions';
COMMENT ON COLUMN prompts.code_block_count IS 'Count of fenced code blocks (```) in the prompt';
COMMENT ON COLUMN prompts.file_ref_count IS 'Count of file references detected in the prompt';
COMMENT ON COLUMN prompts.complexity_level IS 'Complexity classification: simple, moderate, or complex';
COMMENT ON COLUMN prompts.complexity_score IS 'Numeric complexity score from 0-100';
