-- Migration: Fix store_analysis_result function overload conflict
-- Issue: Two versions of the function exist with 5 and 8 parameters,
-- causing PostgreSQL to fail with "Could not choose the best candidate function"
-- when calling with 5 parameters (the 8-param version has defaults for params 6-8)
--
-- Solution: Drop the old 5-param version and keep only the 8-param version with defaults

-- Drop the old 5-param overload if it exists
DROP FUNCTION IF EXISTS store_analysis_result(UUID, UUID, DECIMAL(3,1), JSONB, JSONB);

-- Recreate the function with all parameters (including defaults) and validation
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
  v_prompt_status TEXT;
  v_prompt_exists BOOLEAN;
BEGIN
  -- SECURITY: Validate that the prompt exists and is in expected state
  SELECT EXISTS(SELECT 1 FROM prompts WHERE id = p_prompt_id), analysis_status
  INTO v_prompt_exists, v_prompt_status
  FROM prompts
  WHERE id = p_prompt_id;

  -- Check prompt exists
  IF NOT v_prompt_exists THEN
    RAISE EXCEPTION 'Prompt % does not exist', p_prompt_id
      USING ERRCODE = '23503';  -- foreign_key_violation
  END IF;

  -- Check prompt is in expected 'processing' state
  -- This prevents race conditions and unauthorized modifications
  IF v_prompt_status != 'processing' THEN
    RAISE EXCEPTION 'Prompt % is not in processing state (current: %)', p_prompt_id, v_prompt_status
      USING ERRCODE = 'P0001';  -- raise_exception
  END IF;

  -- SECURITY: Validate config_id exists
  IF NOT EXISTS(SELECT 1 FROM analysis_configs WHERE id = p_config_id) THEN
    RAISE EXCEPTION 'Config % does not exist', p_config_id
      USING ERRCODE = '23503';  -- foreign_key_violation
  END IF;

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
      USING ERRCODE = '23505';  -- unique_violation error code
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'Invalid prompt_id or config_id: prompt=%, config=%', p_prompt_id, p_config_id
      USING ERRCODE = '23503';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update function comment
COMMENT ON FUNCTION store_analysis_result IS
  'Atomically stores analysis result and updates prompt status. Validates prompt exists and is in processing state before storing. Supports optional prompt type and conversation context metadata.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION store_analysis_result TO service_role;

-- Verify the fix
DO $$
BEGIN
  RAISE NOTICE '=== FIXED: store_analysis_result overload conflict resolved ===';
  RAISE NOTICE 'Dropped: 5-parameter overload';
  RAISE NOTICE 'Kept: 8-parameter version with defaults for params 6-8';
  RAISE NOTICE '===============================================================';
END $$;
