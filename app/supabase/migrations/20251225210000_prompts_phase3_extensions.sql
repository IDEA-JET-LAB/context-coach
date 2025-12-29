-- Phase 3: Prompts Table Extensions for Classification and Threading
-- Story 24-2: Prompts Table Extensions
--
-- Note: The story specified `prompt_type` but that column already exists with
-- command detection values ('prompt', 'command', 'command_with_prompt').
-- This migration uses `prompt_classification` for conversation role instead.

-- ============================================
-- ADD PHASE 3 COLUMNS
-- ============================================
-- All columns nullable or with defaults for backward compatibility

-- Conversation role classification (renamed from prompt_type to avoid conflict)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS prompt_classification VARCHAR(50);

-- Classification confidence score
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS prompt_type_confidence DECIMAL(3,2);

-- Claude Code message UUID for transcript correlation
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS message_uuid VARCHAR(100);

-- Parent message UUID for conversation threading
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS parent_message_uuid VARCHAR(100);

-- Debugging loop detection flag
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS is_in_debugging_loop BOOLEAN DEFAULT FALSE;

-- Detected project stage for this prompt
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS detected_stage VARCHAR(50);

-- ============================================
-- ADD CHECK CONSTRAINTS
-- ============================================

-- Valid conversation role classifications
-- (Note: Using IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_prompt_classification'
  ) THEN
    ALTER TABLE prompts ADD CONSTRAINT valid_prompt_classification CHECK (
      prompt_classification IS NULL OR prompt_classification IN (
        'initiating', 'continuation', 'selection', 'correction',
        'confirmation', 'clarification', 'tool_result'
      )
    );
  END IF;
END $$;

-- Valid confidence range (0.00 to 1.00)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_prompt_type_confidence'
  ) THEN
    ALTER TABLE prompts ADD CONSTRAINT valid_prompt_type_confidence CHECK (
      prompt_type_confidence IS NULL OR
      (prompt_type_confidence >= 0.00 AND prompt_type_confidence <= 1.00)
    );
  END IF;
END $$;

-- Valid detected stage values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_prompt_detected_stage'
  ) THEN
    ALTER TABLE prompts ADD CONSTRAINT valid_prompt_detected_stage CHECK (
      detected_stage IS NULL OR detected_stage IN (
        'architecture', 'specification', 'development', 'debugging', 'enhancement',
        -- Include Phase 2 values for consistency with sessions.primary_stage
        'planning', 'implementation', 'refactoring', 'testing', 'documentation',
        'review', 'exploration', 'unknown'
      )
    );
  END IF;
END $$;

-- ============================================
-- PARTIAL INDEXES FOR NEW COLUMNS
-- ============================================

-- Index prompts by classification (only indexed when set)
CREATE INDEX IF NOT EXISTS idx_prompts_classification
  ON prompts(prompt_classification)
  WHERE prompt_classification IS NOT NULL;

-- Index prompts by message UUID for transcript correlation
CREATE INDEX IF NOT EXISTS idx_prompts_message_uuid
  ON prompts(message_uuid)
  WHERE message_uuid IS NOT NULL;

-- Index prompts by parent message UUID for thread reconstruction
CREATE INDEX IF NOT EXISTS idx_prompts_parent_message
  ON prompts(parent_message_uuid)
  WHERE parent_message_uuid IS NOT NULL;

-- Index prompts in debugging loops for pattern analysis
CREATE INDEX IF NOT EXISTS idx_prompts_debugging_loop
  ON prompts(session_uuid, is_in_debugging_loop)
  WHERE is_in_debugging_loop = TRUE;

-- Index prompts by detected stage (only indexed when set)
CREATE INDEX IF NOT EXISTS idx_prompts_detected_stage
  ON prompts(detected_stage)
  WHERE detected_stage IS NOT NULL;

-- ============================================
-- COLUMN COMMENTS
-- ============================================

COMMENT ON COLUMN prompts.prompt_classification IS
  'Conversation role classification. Values: initiating (new task), continuation (provides info), selection (picks option), correction (redirects), confirmation (approves), clarification (asks question), tool_result (system message). Scoring weight: selection/confirmation = 0 (skip scoring).';

COMMENT ON COLUMN prompts.prompt_type_confidence IS
  'Confidence score (0.00-1.00) for the prompt_classification. Higher values indicate more certain classification. Values > 0.9 typically from heuristics, lower values from LLM.';

COMMENT ON COLUMN prompts.message_uuid IS
  'Claude Code message UUID from the transcript. Used to correlate prompts with transcript entries for threading and response lookup.';

COMMENT ON COLUMN prompts.parent_message_uuid IS
  'Claude Code parent message UUID for conversation threading. Supplements parent_prompt_id by storing the original transcript threading.';

COMMENT ON COLUMN prompts.is_in_debugging_loop IS
  'TRUE if this prompt is detected as part of a debugging loop (3+ similar error-fix-error cycles within session)';

COMMENT ON COLUMN prompts.detected_stage IS
  'Project stage detected for this specific prompt: architecture, specification, development, debugging, enhancement, or Phase 2 values';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== PHASE 3: PROMPTS EXTENSIONS COMPLETE ===';
  RAISE NOTICE 'Added columns: prompt_classification, prompt_type_confidence, message_uuid, parent_message_uuid, is_in_debugging_loop, detected_stage';
  RAISE NOTICE 'Note: Used prompt_classification instead of prompt_type to avoid conflict with existing column';
  RAISE NOTICE 'Created indexes: idx_prompts_classification, idx_prompts_message_uuid, idx_prompts_parent_message, idx_prompts_debugging_loop, idx_prompts_detected_stage';
  RAISE NOTICE '=============================================';
END $$;
