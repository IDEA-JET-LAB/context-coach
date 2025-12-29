-- Phase 3: Skipped Analysis Support
-- Story 27-4: Context-Aware Scoring
--
-- Adds support for storing skipped analysis results when prompts
-- are classified as types that don't require scoring (selection, confirmation).

-- ============================================
-- ALTER PROMPT_ANALYSES TABLE
-- ============================================

-- Add skipped flag (FALSE by default for existing records)
ALTER TABLE prompt_analyses
ADD COLUMN IF NOT EXISTS skipped BOOLEAN DEFAULT FALSE;

-- Add skip reason (only populated when skipped is true)
ALTER TABLE prompt_analyses
ADD COLUMN IF NOT EXISTS skip_reason TEXT;

-- Add prompt classification (what type of prompt was analyzed)
ALTER TABLE prompt_analyses
ADD COLUMN IF NOT EXISTS prompt_type VARCHAR(50);

-- Add conversation context metadata
ALTER TABLE prompt_analyses
ADD COLUMN IF NOT EXISTS conversation_context_used BOOLEAN DEFAULT FALSE;

ALTER TABLE prompt_analyses
ADD COLUMN IF NOT EXISTS context_message_count INTEGER DEFAULT 0;

-- Make overall_score nullable for skipped entries
-- Must drop and recreate constraint since we're making it nullable
ALTER TABLE prompt_analyses
ALTER COLUMN overall_score DROP NOT NULL;

-- Make dimension_scores nullable for skipped entries
ALTER TABLE prompt_analyses
ALTER COLUMN dimension_scores DROP NOT NULL;

-- Make suggestions nullable for skipped entries
ALTER TABLE prompt_analyses
ALTER COLUMN suggestions DROP NOT NULL;

-- Make config_id nullable for skipped entries (no config needed)
ALTER TABLE prompt_analyses
ALTER COLUMN config_id DROP NOT NULL;

-- ============================================
-- ADD CHECK CONSTRAINTS
-- ============================================

-- Ensure skip_reason is set when skipped is true
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skipped_requires_reason'
  ) THEN
    ALTER TABLE prompt_analyses ADD CONSTRAINT skipped_requires_reason CHECK (
      (skipped = FALSE) OR (skipped = TRUE AND skip_reason IS NOT NULL)
    );
  END IF;
END $$;

-- Ensure scored entries have required fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scored_requires_scores'
  ) THEN
    ALTER TABLE prompt_analyses ADD CONSTRAINT scored_requires_scores CHECK (
      (skipped = TRUE) OR (
        skipped = FALSE AND
        overall_score IS NOT NULL AND
        dimension_scores IS NOT NULL AND
        config_id IS NOT NULL
      )
    );
  END IF;
END $$;

-- Valid prompt_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_analysis_prompt_type'
  ) THEN
    ALTER TABLE prompt_analyses ADD CONSTRAINT valid_analysis_prompt_type CHECK (
      prompt_type IS NULL OR prompt_type IN (
        'initiating', 'continuation', 'selection', 'correction',
        'confirmation', 'clarification', 'tool_result'
      )
    );
  END IF;
END $$;

-- Update score constraint to allow NULL for skipped entries
ALTER TABLE prompt_analyses DROP CONSTRAINT IF EXISTS valid_overall_score;
ALTER TABLE prompt_analyses ADD CONSTRAINT valid_overall_score CHECK (
  overall_score IS NULL OR (overall_score >= 1 AND overall_score <= 10)
);

-- ============================================
-- INDEXES FOR NEW COLUMNS
-- ============================================

-- Index for finding skipped analyses
CREATE INDEX IF NOT EXISTS idx_prompt_analyses_skipped
  ON prompt_analyses(skipped)
  WHERE skipped = TRUE;

-- Index for prompt type filtering
CREATE INDEX IF NOT EXISTS idx_prompt_analyses_prompt_type
  ON prompt_analyses(prompt_type)
  WHERE prompt_type IS NOT NULL;

-- ============================================
-- STORE SKIPPED ANALYSIS FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION store_skipped_analysis(
  p_prompt_id UUID,
  p_prompt_type VARCHAR(50),
  p_skip_reason TEXT,
  p_confidence DECIMAL(3,2) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_analysis_id UUID;
BEGIN
  -- Insert skipped analysis record
  INSERT INTO prompt_analyses (
    prompt_id,
    skipped,
    skip_reason,
    prompt_type,
    overall_score,
    dimension_scores,
    suggestions,
    config_id
  )
  VALUES (
    p_prompt_id,
    TRUE,
    p_skip_reason,
    p_prompt_type,
    NULL,
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT (prompt_id) DO UPDATE SET
    skipped = TRUE,
    skip_reason = p_skip_reason,
    prompt_type = p_prompt_type
  RETURNING id INTO v_analysis_id;

  -- Update prompt status to 'skipped' and classification
  UPDATE prompts
  SET
    analysis_status = 'skipped',
    prompt_classification = COALESCE(prompts.prompt_classification, p_prompt_type),
    prompt_type_confidence = COALESCE(prompts.prompt_type_confidence, p_confidence)
  WHERE id = p_prompt_id;

  RETURN v_analysis_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION store_skipped_analysis TO service_role;

COMMENT ON FUNCTION store_skipped_analysis IS
  'Stores a skipped analysis result for prompts that do not require scoring (selection, confirmation)';

-- ============================================
-- UPDATE STORE_ANALYSIS_RESULT FUNCTION
-- ============================================
-- Add prompt_type and context metadata parameters
CREATE OR REPLACE FUNCTION store_analysis_result(
  p_prompt_id UUID,
  p_config_id UUID,
  p_overall_score DECIMAL(3,1),
  p_dimension_scores JSONB,
  p_suggestions JSONB,
  p_prompt_type VARCHAR(50) DEFAULT NULL,
  p_conversation_context_used BOOLEAN DEFAULT FALSE,
  p_context_message_count INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  v_analysis_id UUID;
BEGIN
  -- Insert analysis record
  INSERT INTO prompt_analyses (
    prompt_id,
    config_id,
    overall_score,
    dimension_scores,
    suggestions,
    skipped,
    prompt_type,
    conversation_context_used,
    context_message_count
  )
  VALUES (
    p_prompt_id,
    p_config_id,
    p_overall_score,
    p_dimension_scores,
    p_suggestions,
    FALSE,
    p_prompt_type,
    p_conversation_context_used,
    p_context_message_count
  )
  RETURNING id INTO v_analysis_id;

  -- Update prompt status to complete and classification
  UPDATE prompts
  SET
    analysis_status = 'complete',
    prompt_classification = COALESCE(prompts.prompt_classification, p_prompt_type)
  WHERE id = p_prompt_id;

  RETURN v_analysis_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Analysis already exists for prompt %', p_prompt_id
      USING ERRCODE = '23505';
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'Invalid prompt_id or config_id: prompt=%, config=%', p_prompt_id, p_config_id
      USING ERRCODE = '23503';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COLUMN COMMENTS
-- ============================================

COMMENT ON COLUMN prompt_analyses.skipped IS
  'TRUE if scoring was skipped for this prompt (e.g., selection/confirmation types)';

COMMENT ON COLUMN prompt_analyses.skip_reason IS
  'Reason why scoring was skipped. Required when skipped is TRUE.';

COMMENT ON COLUMN prompt_analyses.prompt_type IS
  'The classified prompt type: initiating, continuation, selection, correction, confirmation, clarification';

COMMENT ON COLUMN prompt_analyses.conversation_context_used IS
  'TRUE if conversation context was used for scoring this prompt';

COMMENT ON COLUMN prompt_analyses.context_message_count IS
  'Number of prior conversation messages included in analysis context';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== PHASE 3: SKIPPED ANALYSIS SUPPORT COMPLETE ===';
  RAISE NOTICE 'Added columns: skipped, skip_reason, prompt_type, conversation_context_used, context_message_count';
  RAISE NOTICE 'Made nullable: overall_score, dimension_scores, suggestions, config_id';
  RAISE NOTICE 'Created function: store_skipped_analysis(prompt_id, prompt_type, skip_reason, confidence)';
  RAISE NOTICE 'Updated function: store_analysis_result with new parameters';
  RAISE NOTICE '===================================================';
END $$;
